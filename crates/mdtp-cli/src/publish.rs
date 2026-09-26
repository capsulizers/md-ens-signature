//! `mdtp publish`: publish a Markdown file to Ethereum under a name.

use std::path::PathBuf;
use std::process::ExitCode;
use std::time::Duration;

use alloy_primitives::{Address, B256, Signature, U256, hex, keccak256};
use anyhow::{Context, anyhow, bail};
use k256::ecdsa::SigningKey;
use mdtp::ens::EthCall;
use mdtp::names::{NameSystem, name_system};
use mdtp::publish::{
  JsonRpc, RECORD_KEY, Record, format_record, publish_calldata,
};
use mdtp::signature::address_of;
use serde_json::{Value, json};
use tracing::info;

use crate::rpc::{DEFAULT_RPC, Rpc, block_on};
use crate::sign::private_key;

/// The EIP-2718 type byte of an EIP-1559 transaction.
const EIP1559_TYPE: u8 = 2;
/// How often to ask whether a sent transaction is mined.
const RECEIPT_POLL: Duration = Duration::from_secs(3);
/// How many times to ask before giving up on a transaction.
const RECEIPT_TRIES: u32 = 100;

/// Publish a Markdown file to Ethereum under a document name.
///
/// Sends two transactions from the key's address: one to itself carrying
/// the file, and one setting the document name's `mdtp` text record to it.
/// The key is read from an environment variable, never from the command
/// line.
#[derive(clap::Args)]
pub struct Args {
  /// The Markdown file to publish.
  file: PathBuf,
  /// The document name to publish under, such as `skills.mdsig91205.eth`.
  #[arg(long)]
  name: String,
  /// The ENS name that publishes, which the key's address must own.
  #[arg(long)]
  publisher: String,
  /// The environment variable holding the `0x` hex private key.
  #[arg(long, default_value = "MDTP_PRIVATE_KEY")]
  key_env: String,
  /// The Sepolia JSON-RPC endpoint.
  #[arg(long, default_value = DEFAULT_RPC)]
  rpc: String,
}

/// Publishes the file, waits for both transactions, and prints their
/// hashes.
pub fn run(args: &Args) -> anyhow::Result<ExitCode> {
  let key = private_key(&args.key_env)?;
  let markdown = std::fs::read_to_string(&args.file)
    .with_context(|| format!("Failed to read {}", args.file.display()))?;
  block_on(publish(args, &key, &markdown))??;
  Ok(ExitCode::SUCCESS)
}

/// A signer bound to one account, chain, and fee level.
struct Sender<'a> {
  rpc: &'a Rpc,
  key: SigningKey,
  from: Address,
  chain_id: u64,
  max_priority_fee: u128,
  max_fee: u128,
}

async fn publish(
  args: &Args,
  key: &[u8; 32],
  markdown: &str,
) -> anyhow::Result<()> {
  let rpc = Rpc::new(&args.rpc);
  let name = args.name.trim().to_lowercase();
  let names = name_system(&name)?;
  let node_chain = quantity(&rpc.request("eth_chainId", json!([])).await?)?;
  if node_chain != u128::from(names.chain_id()) {
    bail!(
      "The node serves chain {node_chain}, not {}",
      names.chain_id()
    );
  }
  let from = address_of(key)?;
  let tip =
    quantity(&rpc.request("eth_maxPriorityFeePerGas", json!([])).await?)?;
  let latest = rpc
    .request("eth_getBlockByNumber", json!(["latest", false]))
    .await?;
  let base_fee = quantity(&latest["baseFeePerGas"])?;
  let sender = Sender {
    rpc: &rpc,
    key: SigningKey::from_slice(key)
      .map_err(|_| anyhow!("The private key is not a valid key"))?,
    from,
    chain_id: names.chain_id(),
    max_priority_fee: tip,
    max_fee: base_fee * 2 + tip,
  };
  let nonce = quantity(
    &rpc
      .request(
        "eth_getTransactionCount",
        json!([from.to_string(), "pending"]),
      )
      .await?,
  )?;
  let nonce = u64::try_from(nonce)?;

  let content = EthCall {
    to: from,
    data: publish_calldata(&args.publisher, markdown),
  };
  let (content_raw, content_hash) = sender.sign(&content, nonce).await?;
  let record = format_record(&Record {
    chain_id: names.chain_id(),
    tx_hash: content_hash,
  });
  let set_text = names.set_text(&name, RECORD_KEY, &record, &rpc).await?;
  let (record_raw, record_hash) = sender
    .sign(&set_text, nonce + 1)
    .await
    .context("The key may not set the record; is it allowed to write it?")?;

  sender.send(&content_raw).await?;
  info!("Sent the content transaction {content_hash}");
  sender.send(&record_raw).await?;
  info!("Sent the record transaction {record_hash}");
  sender.wait(content_hash).await?;
  sender.wait(record_hash).await?;
  println!("name: {name}");
  println!("publisher: {}", args.publisher.trim().to_lowercase());
  println!("from: {from}");
  println!("content transaction: {content_hash}");
  println!("record transaction: {record_hash}");
  println!("record: {record}");
  Ok(())
}

impl Sender<'_> {
  /// Estimates gas for `call` and signs it as an EIP-1559 transaction with
  /// `nonce`, returning the raw transaction and its hash.
  async fn sign(
    &self,
    call: &EthCall,
    nonce: u64,
  ) -> anyhow::Result<(Vec<u8>, B256)> {
    let estimate = self
      .rpc
      .request(
        "eth_estimateGas",
        json!([{
          "from": self.from.to_string(),
          "to": call.to.to_string(),
          "data": hex::encode_prefixed(&call.data),
        }]),
      )
      .await?;
    let gas = quantity(&estimate)? * 6 / 5;
    let fields = [
      alloy_rlp::encode(self.chain_id),
      alloy_rlp::encode(nonce),
      alloy_rlp::encode(self.max_priority_fee),
      alloy_rlp::encode(self.max_fee),
      alloy_rlp::encode(gas),
      alloy_rlp::encode(call.to),
      alloy_rlp::encode(U256::ZERO),
      alloy_rlp::encode(call.data.as_slice()),
      vec![alloy_rlp::EMPTY_LIST_CODE],
    ];
    let digest = keccak256(typed(&rlp_list(&fields)));
    let (signature, recovery_id) = self
      .key
      .sign_prehash_recoverable(digest.as_slice())
      .map_err(|_| anyhow!("Failed to sign the transaction"))?;
    let signature = Signature::from((signature, recovery_id));
    let mut fields = fields.to_vec();
    fields.push(alloy_rlp::encode(signature.v()));
    fields.push(alloy_rlp::encode(signature.r()));
    fields.push(alloy_rlp::encode(signature.s()));
    let raw = typed(&rlp_list(&fields));
    let hash = keccak256(&raw);
    Ok((raw, hash))
  }

  /// Broadcasts a raw transaction.
  async fn send(&self, raw: &[u8]) -> anyhow::Result<()> {
    self
      .rpc
      .request("eth_sendRawTransaction", json!([hex::encode_prefixed(raw)]))
      .await?;
    Ok(())
  }

  /// Waits until the transaction is mined and fails if it reverted.
  async fn wait(&self, hash: B256) -> anyhow::Result<()> {
    for _ in 0..RECEIPT_TRIES {
      let receipt = self
        .rpc
        .request("eth_getTransactionReceipt", json!([hash.to_string()]))
        .await?;
      if !receipt.is_null() {
        if quantity(&receipt["status"])? != 1 {
          bail!("The transaction {hash} reverted");
        }
        return Ok(());
      }
      tokio::time::sleep(RECEIPT_POLL).await;
    }
    bail!("The transaction {hash} was not mined in time")
  }
}

/// Wraps pre-encoded RLP items in a list.
fn rlp_list(items: &[Vec<u8>]) -> Vec<u8> {
  let payload_length = items.iter().map(Vec::len).sum();
  let mut out = Vec::with_capacity(payload_length + 9);
  alloy_rlp::Header {
    list: true,
    payload_length,
  }
  .encode(&mut out);
  for item in items {
    out.extend_from_slice(item);
  }
  out
}

/// Prefixes an RLP payload with the EIP-1559 type byte.
fn typed(payload: &[u8]) -> Vec<u8> {
  [&[EIP1559_TYPE][..], payload].concat()
}

/// Parses a JSON-RPC hex quantity such as `"0x1b4"`.
fn quantity(value: &Value) -> anyhow::Result<u128> {
  value
    .as_str()
    .and_then(|text| text.strip_prefix("0x"))
    .and_then(|digits| u128::from_str_radix(digits, 16).ok())
    .ok_or_else(|| anyhow!("{value} is not a hex quantity"))
}

#[cfg(test)]
mod tests {
  use super::{rlp_list, typed};

  #[test]
  fn rlp_list_prefixes_the_payload_length() {
    let items = [alloy_rlp::encode(1_u64), alloy_rlp::encode("dog")];
    assert_eq!(rlp_list(&items), [0xc5, 0x01, 0x83, b'd', b'o', b'g']);
    assert_eq!(typed(&rlp_list(&[])), [0x02, 0xc0]);
  }
}
