//! Publishing a Markdown file to Ethereum and reading it back.
//!
//! A publisher sends one transaction to its own address whose calldata is
//! [`publish_calldata`], then points the document name's `mdtp` text record
//! at it with [`set_text_call`]. [`read`] follows the record back to the
//! transaction and judges it with the same ENSv2 ownership rule as
//! signatures.
//!
//! Like the rest of the library this is sans-IO. `eth_call` goes through an
//! [`EthCaller`], and the two other JSON-RPC methods reading needs,
//! `eth_getTransactionByHash` and `eth_getBlockByNumber`, go through a
//! [`JsonRpc`].

use alloy_primitives::{Address, B256, hex};
use anyhow::{Context, anyhow, bail};
use serde_json::{Value, json};

use crate::ens::{EthCall, text_call};
use crate::names::{NameSystem, name_system};
use crate::verify::EthCaller;

/// The text record key that points a document name at its transaction.
pub const RECORD_KEY: &str = "mdtp";

/// What published calldata starts with, before the publisher name.
const CALLDATA_PREFIX: &str = "mdtp/1\npublisher: ";

/// Sends one JSON-RPC request and returns its `result`.
///
/// Like [`EthCaller`], the method is an `async fn` whose future need not be
/// `Send`, so a browser can implement it with `fetch`. A JSON-RPC `error`
/// answer should come back as an `Err`.
#[allow(async_fn_in_trait)]
pub trait JsonRpc {
  /// Calls `method` with the JSON array `params` and returns the `result`
  /// member of the answer, which may be `null`.
  async fn request(&self, method: &str, params: Value)
  -> anyhow::Result<Value>;
}

/// A JSON-RPC method and its parameters, for a [`JsonRpc`] to send.
#[derive(Clone, Debug, PartialEq)]
pub struct RpcRequest {
  /// The method name.
  pub method: &'static str,
  /// The parameters, a JSON array.
  pub params: Value,
}

/// Sends an [`EthCall`] through a [`JsonRpc`] against the latest block, so
/// an embedder can implement [`EthCaller`] in one line.
pub async fn eth_call<R: JsonRpc>(
  rpc: &R,
  call: &EthCall,
) -> anyhow::Result<Vec<u8>> {
  let params = json!([
    { "to": call.to.to_string(), "data": hex::encode_prefixed(&call.data) },
    "latest",
  ]);
  let result = rpc.request("eth_call", params).await?;
  let result = result
    .as_str()
    .ok_or_else(|| anyhow!("The eth_call result is not a string"))?;
  hex::decode(result).context("The eth_call result is not hex")
}

/// Builds the calldata of a publishing transaction: UTF-8 text of
/// `mdtp/1`, a `publisher:` line with the lowercase publisher name, a blank
/// line, and the Markdown bytes unchanged.
pub fn publish_calldata(publisher: &str, markdown: &str) -> Vec<u8> {
  let publisher = publisher.trim().to_lowercase();
  format!("{CALLDATA_PREFIX}{publisher}\n\n{markdown}").into_bytes()
}

/// Reads the publisher name and Markdown back out of [`publish_calldata`],
/// or `None` when the bytes do not have that format.
pub fn parse_calldata(input: &[u8]) -> Option<(String, String)> {
  let text = std::str::from_utf8(input).ok()?;
  let rest = text.strip_prefix(CALLDATA_PREFIX)?;
  let (publisher, markdown) = rest.split_once("\n\n")?;
  let valid = !publisher.is_empty()
    && publisher == publisher.trim().to_lowercase()
    && !publisher.contains('\n');
  valid.then(|| (publisher.to_owned(), markdown.to_owned()))
}

/// Where a document's `mdtp` record points: a transaction on a chain.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Record {
  /// The EIP-155 chain id.
  pub chain_id: u64,
  /// The publishing transaction's hash.
  pub tx_hash: B256,
}

/// Formats the `mdtp` record value `eip155:<chain id>:<tx hash>`.
pub fn format_record(record: &Record) -> String {
  format!("eip155:{}:{}", record.chain_id, record.tx_hash)
}

/// Parses an `mdtp` record value `eip155:<chain id>:<0x tx hash>`.
pub fn parse_record(value: &str) -> anyhow::Result<Record> {
  let mut parts = value.trim().split(':');
  let (Some("eip155"), Some(chain_id), Some(tx_hash), None) =
    (parts.next(), parts.next(), parts.next(), parts.next())
  else {
    bail!("The record is not eip155:<chain id>:<tx hash>");
  };
  let chain_id = chain_id
    .parse()
    .map_err(|_| anyhow!("The record's chain id is not a number"))?;
  if !tx_hash.starts_with("0x") {
    bail!("The record's transaction hash does not start with 0x");
  }
  let tx_hash = hex::decode_to_array(tx_hash)
    .map_err(|_| anyhow!("The record's transaction hash is not 32 bytes"))?;
  Ok(Record {
    chain_id,
    tx_hash: tx_hash.into(),
  })
}

/// Builds the call that sets `doc_name`'s `mdtp` record to `value` on
/// `resolver`, which the sender must be allowed to write.
pub fn set_text_call(
  resolver: Address,
  doc_name: &str,
  value: &str,
) -> EthCall {
  crate::ens::set_text_call(resolver, doc_name, RECORD_KEY, value)
}

/// Builds the call reading `doc_name`'s `mdtp` record through the Sepolia
/// Universal Resolver's `resolve`. Decode it with
/// [`decode_text`](crate::ens::decode_text).
pub fn read_record_call(doc_name: &str) -> anyhow::Result<EthCall> {
  text_call(doc_name, RECORD_KEY)
}

/// The fields of a transaction that reading needs.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Transaction {
  /// The sender.
  pub from: Address,
  /// The calldata.
  pub input: Vec<u8>,
  /// The block that holds it, or `None` while it is pending.
  pub block: Option<u64>,
}

/// Builds the `eth_getTransactionByHash` request for `tx_hash`.
pub fn transaction_request(tx_hash: B256) -> RpcRequest {
  RpcRequest {
    method: "eth_getTransactionByHash",
    params: json!([tx_hash.to_string()]),
  }
}

/// Reads the result of a [`transaction_request`], or `None` when the node
/// does not know the transaction.
pub fn parse_transaction(
  result: &Value,
) -> anyhow::Result<Option<Transaction>> {
  if result.is_null() {
    return Ok(None);
  }
  let field = |name: &str| {
    result
      .get(name)
      .and_then(Value::as_str)
      .ok_or_else(|| anyhow!("The transaction has no {name}"))
  };
  let from = field("from")?
    .parse()
    .map_err(|_| anyhow!("The transaction's from is not an address"))?;
  let input = hex::decode(field("input")?)
    .context("The transaction's input is not hex")?;
  let block = match result.get("blockNumber").and_then(Value::as_str) {
    Some(number) => Some(parse_quantity(number)?),
    None => None,
  };
  Ok(Some(Transaction { from, input, block }))
}

/// Builds the `eth_getBlockByNumber` request for `block`, without its
/// transactions.
pub fn block_request(block: u64) -> RpcRequest {
  RpcRequest {
    method: "eth_getBlockByNumber",
    params: json!([format!("{block:#x}"), false]),
  }
}

/// Reads the timestamp, in Unix seconds, from a [`block_request`] result.
pub fn parse_block_timestamp(result: &Value) -> anyhow::Result<u64> {
  let timestamp = result
    .get("timestamp")
    .and_then(Value::as_str)
    .ok_or_else(|| anyhow!("The block has no timestamp"))?;
  parse_quantity(timestamp)
}

/// Parses a JSON-RPC hex quantity such as `0x1b4`.
fn parse_quantity(quantity: &str) -> anyhow::Result<u64> {
  quantity
    .strip_prefix("0x")
    .and_then(|digits| u64::from_str_radix(digits, 16).ok())
    .ok_or_else(|| anyhow!("{quantity} is not a hex quantity"))
}

/// The verdict on a published document.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PublishVerdict {
  /// The name has no `mdtp` record, or its transaction is unknown or still
  /// pending.
  NotFound,
  /// The record or the transaction's calldata is not in the publishing
  /// format.
  Tampered,
  /// The sender does not own the publisher name now, or the publisher may
  /// not publish under the document name.
  Unauthorized,
  /// The owner of the publisher name published it.
  Verified,
}

/// A document read back from the chain, with its verdict.
///
/// Fields the reader never got to stay empty: zero, the zero address, or
/// the empty string. A [`PublishVerdict::NotFound`] document has at most a
/// `tx_hash`, and a [`PublishVerdict::Tampered`] one has no `publisher` or
/// `markdown`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Published {
  /// The lowercase document name.
  pub name: String,
  /// The verdict.
  pub verdict: PublishVerdict,
  /// The publishing transaction, when the record names one.
  pub tx_hash: Option<B256>,
  /// The lowercase publisher name the calldata claims.
  pub publisher: String,
  /// The transaction's sender.
  pub from: Address,
  /// The published Markdown.
  pub markdown: String,
  /// The block that holds the transaction.
  pub block: u64,
  /// The block's timestamp in Unix seconds (UTC), the published time.
  pub timestamp: u64,
}

/// Whether `publisher` may publish under `doc_name`: it is the document
/// name, one of its ancestors below the top-level domain, or a subname of
/// the document's parent. Both names are lowercase.
pub fn may_publish(publisher: &str, doc_name: &str) -> bool {
  if publisher == doc_name {
    return true;
  }
  let Some((_, parent)) = doc_name.split_once('.') else {
    return false;
  };
  if !parent.contains('.') {
    return false;
  }
  publisher.ends_with(&format!(".{parent}"))
    || (publisher.contains('.') && doc_name.ends_with(&format!(".{publisher}")))
}

/// Reads the document published under `doc_name` and judges it.
///
/// The rule: follow the name's `mdtp` record to its transaction; no record,
/// or an unknown or pending transaction, is [`PublishVerdict::NotFound`]. A
/// record, chain, or calldata out of format is [`PublishVerdict::Tampered`].
/// The document is [`PublishVerdict::Verified`] when the sender owns the
/// publisher name now, which is not the zero address, and
/// [`may_publish`] lets that publisher publish under `doc_name`. Otherwise
/// it is [`PublishVerdict::Unauthorized`]. Errors come only from the
/// caller, such as an unreachable node, or from a name no name system
/// serves.
pub async fn read<C: EthCaller + JsonRpc>(
  doc_name: &str,
  caller: &C,
) -> anyhow::Result<Published> {
  let name = doc_name.trim().to_lowercase();
  let names = name_system(&name)?;
  let mut published = Published {
    name,
    verdict: PublishVerdict::NotFound,
    tx_hash: None,
    publisher: String::new(),
    from: Address::ZERO,
    markdown: String::new(),
    block: 0,
    timestamp: 0,
  };
  let Some(value) = names.text(&published.name, RECORD_KEY, caller).await?
  else {
    return Ok(published);
  };
  let record = match parse_record(&value) {
    Ok(record) if record.chain_id == names.chain_id() => record,
    _ => {
      published.verdict = PublishVerdict::Tampered;
      return Ok(published);
    }
  };
  published.tx_hash = Some(record.tx_hash);
  let request = transaction_request(record.tx_hash);
  let result = caller.request(request.method, request.params).await?;
  let Some(Transaction {
    from,
    input,
    block: Some(block),
  }) = parse_transaction(&result)?
  else {
    return Ok(published);
  };
  published.from = from;
  published.block = block;
  let request = block_request(block);
  let result = caller.request(request.method, request.params).await?;
  published.timestamp = parse_block_timestamp(&result)?;
  let Some((publisher, markdown)) = parse_calldata(&input) else {
    published.verdict = PublishVerdict::Tampered;
    return Ok(published);
  };
  published.verdict = match name_system(&publisher) {
    Ok(system) if may_publish(&publisher, &published.name) => {
      let owner = system.owner(&publisher, caller).await?;
      if owner != Address::ZERO && owner == from {
        PublishVerdict::Verified
      } else {
        PublishVerdict::Unauthorized
      }
    }
    _ => PublishVerdict::Unauthorized,
  };
  published.publisher = publisher;
  published.markdown = markdown;
  Ok(published)
}

#[cfg(test)]
mod tests {
  use std::future::Future;
  use std::pin::pin;
  use std::task::{Context, Poll, Waker};

  use alloy_primitives::{Address, B256, U256, address, b256};
  use alloy_sol_types::SolValue;
  use anyhow::{anyhow, bail};
  use serde_json::{Value, json};

  use super::{
    JsonRpc, PublishVerdict, Record, block_request, eth_call, format_record,
    may_publish, parse_block_timestamp, parse_calldata, parse_record,
    parse_transaction, publish_calldata, read, read_record_call,
    transaction_request,
  };
  use crate::ens::{EthCall, find_owner_call, find_resolver_call};
  use crate::verify::EthCaller;

  const DOC: &str = "skills.mdsig91205.eth";
  const PUBLISHER: &str = "mdsig91205.eth";
  const ALICE: Address = address!("0x5D279927926977c28685C184C48fC72e31Bdb7D6");
  const RESOLVER: Address =
    address!("0xCCb6bEf32EE256498ec3F9B19c6eBa1400cB74d1");
  const TX: B256 =
    b256!("0x1111111111111111111111111111111111111111111111111111111111111111");
  const MARKDOWN: &str = "---\nname: skill\n---\n# Hi\n";

  /// A fake Sepolia holding one record, one transaction, and owners.
  struct FakeChain {
    record: Option<String>,
    owners: Vec<(&'static str, Address)>,
    transaction: Value,
  }

  impl FakeChain {
    fn published(publisher: &str, from: Address) -> Self {
      let input = publish_calldata(publisher, MARKDOWN);
      Self {
        record: Some(format!("eip155:11155111:{TX}")),
        owners: vec![(PUBLISHER, ALICE)],
        transaction: json!({
          "from": from.to_string(),
          "input": alloy_primitives::hex::encode_prefixed(input),
          "blockNumber": "0x10",
        }),
      }
    }
  }

  impl EthCaller for FakeChain {
    async fn call(&self, call: &EthCall) -> anyhow::Result<Vec<u8>> {
      if call.data == find_resolver_call(DOC)?.data {
        let resolver = match self.record {
          Some(_) => RESOLVER,
          None => Address::ZERO,
        };
        return Ok((resolver, B256::ZERO, U256::ZERO).abi_encode());
      }
      if call.data == read_record_call(DOC)?.data {
        let text = self.record.clone().unwrap_or_default().abi_encode();
        return Ok((text, RESOLVER).abi_encode_params());
      }
      for (name, owner) in &self.owners {
        if call.data == find_owner_call(name)?.data {
          return Ok(owner.abi_encode());
        }
      }
      if call.data[..4] == find_owner_call(DOC)?.data[..4] {
        return Ok(Address::ZERO.abi_encode());
      }
      bail!("unexpected call")
    }
  }

  impl JsonRpc for FakeChain {
    async fn request(
      &self,
      method: &str,
      params: Value,
    ) -> anyhow::Result<Value> {
      if method == "eth_getTransactionByHash"
        && params == json!([TX.to_string()])
      {
        return Ok(self.transaction.clone());
      }
      if method == "eth_getBlockByNumber" && params == json!(["0x10", false]) {
        return Ok(json!({ "timestamp": "0x68d5f000" }));
      }
      if method == "eth_call" {
        return Ok(json!("0x00ff"));
      }
      Ok(Value::Null)
    }
  }

  /// Runs a future that never waits, as every fake's does.
  fn run<T>(future: impl Future<Output = T>) -> anyhow::Result<T> {
    let mut context = Context::from_waker(Waker::noop());
    match pin!(future).poll(&mut context) {
      Poll::Ready(value) => Ok(value),
      Poll::Pending => Err(anyhow!("the future waited")),
    }
  }

  #[test]
  fn calldata_round_trips() {
    let input = publish_calldata(" MDSIG91205.eth ", MARKDOWN);
    assert!(input.starts_with(b"mdtp/1\npublisher: mdsig91205.eth\n\n---"));
    let parsed = parse_calldata(&input);
    assert_eq!(parsed, Some((PUBLISHER.to_owned(), MARKDOWN.to_owned())));
  }

  #[test]
  fn parse_calldata_rejects_other_formats() {
    for input in [
      &b""[..],
      b"mdtp/2\npublisher: a.eth\n\nx",
      b"mdtp/1\npublisher: A.eth\n\nx",
      b"mdtp/1\npublisher: \n\nx",
      b"mdtp/1\npublisher: a.eth\nx",
      b"mdtp/1\npublisher: a.eth\n\n\xff",
    ] {
      assert_eq!(parse_calldata(input), None, "{input:?}");
    }
  }

  #[test]
  fn record_round_trips() -> anyhow::Result<()> {
    let record = Record {
      chain_id: 11_155_111,
      tx_hash: TX,
    };
    let value = format_record(&record);
    assert_eq!(value, format!("eip155:11155111:{TX}"));
    assert_eq!(parse_record(&value)?, record);
    for bad in [
      "",
      "eip155:11155111",
      "eip155:x:0x11",
      "cosmos:1:0x11",
      "eip155:1:1111111111111111111111111111111111111111111111111111111111111111",
      "eip155:1:0x11:extra",
    ] {
      assert!(parse_record(bad).is_err(), "{bad:?}");
    }
    Ok(())
  }

  #[test]
  fn transaction_parsing_reads_from_input_and_block() -> anyhow::Result<()> {
    let request = transaction_request(TX);
    assert_eq!(request.method, "eth_getTransactionByHash");
    let chain = FakeChain::published(PUBLISHER, ALICE);
    let transaction =
      parse_transaction(&chain.transaction)?.ok_or_else(|| anyhow!("none"))?;
    assert_eq!(transaction.from, ALICE);
    assert_eq!(transaction.block, Some(16));
    assert_eq!(parse_transaction(&Value::Null)?, None);
    let pending = json!({ "from": ALICE.to_string(), "input": "0x" });
    assert_eq!(parse_transaction(&pending)?.and_then(|tx| tx.block), None);
    assert!(parse_transaction(&json!({ "from": "0x12" })).is_err());
    Ok(())
  }

  #[test]
  fn block_request_asks_without_transactions() -> anyhow::Result<()> {
    let request = block_request(255);
    assert_eq!(request.method, "eth_getBlockByNumber");
    assert_eq!(request.params, json!(["0xff", false]));
    assert_eq!(parse_block_timestamp(&json!({ "timestamp": "0x10" }))?, 16);
    assert!(parse_block_timestamp(&json!({ "timestamp": "16" })).is_err());
    Ok(())
  }

  #[test]
  fn eth_call_decodes_the_hex_result() -> anyhow::Result<()> {
    let chain = FakeChain::published(PUBLISHER, ALICE);
    let call = find_owner_call(PUBLISHER)?;
    assert_eq!(run(eth_call(&chain, &call))??, [0, 255]);
    Ok(())
  }

  #[test]
  fn may_publish_follows_the_parent_chain() {
    assert!(may_publish(DOC, DOC));
    assert!(may_publish(PUBLISHER, DOC));
    assert!(may_publish("bob.mdsig91205.eth", DOC));
    assert!(may_publish(PUBLISHER, PUBLISHER));
    assert!(!may_publish("other.eth", DOC));
    assert!(!may_publish("eth", DOC));
    assert!(!may_publish("bob.mdsig91205.eth", PUBLISHER));
    assert!(!may_publish("xmdsig91205.eth", DOC));
  }

  #[test]
  fn owner_publication_is_verified() -> anyhow::Result<()> {
    let chain = FakeChain::published(PUBLISHER, ALICE);
    let published = run(read(" Skills.mdsig91205.eth", &chain))??;
    assert_eq!(published.verdict, PublishVerdict::Verified);
    assert_eq!(published.name, DOC);
    assert_eq!(published.tx_hash, Some(TX));
    assert_eq!(published.publisher, PUBLISHER);
    assert_eq!(published.from, ALICE);
    assert_eq!(published.markdown, MARKDOWN);
    assert_eq!(published.block, 16);
    assert_eq!(published.timestamp, 0x68d5_f000);
    Ok(())
  }

  #[test]
  fn another_sender_is_unauthorized() -> anyhow::Result<()> {
    let chain = FakeChain::published(PUBLISHER, Address::repeat_byte(7));
    let published = run(read(DOC, &chain))??;
    assert_eq!(published.verdict, PublishVerdict::Unauthorized);
    assert_eq!(published.markdown, MARKDOWN);
    Ok(())
  }

  #[test]
  fn unregistered_or_outside_publisher_is_unauthorized() -> anyhow::Result<()> {
    for publisher in ["ghost.mdsig91205.eth", "mdsig91205.com"] {
      let chain = FakeChain::published(publisher, ALICE);
      let published = run(read(DOC, &chain))??;
      assert_eq!(published.verdict, PublishVerdict::Unauthorized);
    }
    let mut chain = FakeChain::published("other.eth", ALICE);
    chain.owners.push(("other.eth", ALICE));
    let published = run(read(DOC, &chain))??;
    assert_eq!(published.verdict, PublishVerdict::Unauthorized);
    Ok(())
  }

  #[test]
  fn missing_record_or_transaction_is_not_found() -> anyhow::Result<()> {
    let mut chain = FakeChain::published(PUBLISHER, ALICE);
    chain.record = None;
    let published = run(read(DOC, &chain))??;
    assert_eq!(published.verdict, PublishVerdict::NotFound);
    assert_eq!(published.tx_hash, None);
    let mut chain = FakeChain::published(PUBLISHER, ALICE);
    chain.transaction = Value::Null;
    assert_eq!(run(read(DOC, &chain))??.verdict, PublishVerdict::NotFound);
    Ok(())
  }

  #[test]
  fn bad_record_or_calldata_is_tampered() -> anyhow::Result<()> {
    let mut chain = FakeChain::published(PUBLISHER, ALICE);
    chain.record = Some(format!("eip155:1:{TX}"));
    assert_eq!(run(read(DOC, &chain))??.verdict, PublishVerdict::Tampered);
    let mut chain = FakeChain::published(PUBLISHER, ALICE);
    chain.transaction["input"] = json!("0x1234");
    let published = run(read(DOC, &chain))??;
    assert_eq!(published.verdict, PublishVerdict::Tampered);
    assert_eq!(published.from, ALICE);
    Ok(())
  }

  #[test]
  fn unsupported_names_are_errors() {
    let chain = FakeChain::published(PUBLISHER, ALICE);
    assert!(matches!(
      run(read("skills.example.com", &chain)),
      Ok(Err(_))
    ));
  }
}
