//! JavaScript bindings for `md-ens-signature`, compiled to WebAssembly with
//! `wasm-bindgen`.
//!
//! Every function takes the whole Markdown file as a string. Failures throw a
//! JavaScript `Error` with a generic message.

use alloy_primitives::hex;
use anyhow::{anyhow, bail};
use js_sys::{Object, Promise, Reflect};
use md_ens_signature::document::{self, SignatureFields};
use md_ens_signature::ens::EthCall;
use md_ens_signature::publish::{self, JsonRpc, PublishVerdict};
use md_ens_signature::signature;
use md_ens_signature::verify::{self, EthCaller, Verdict};
use serde_json::{Value, json};
use wasm_bindgen::JsCast;
use wasm_bindgen::prelude::{JsError, JsValue, wasm_bindgen};
use wasm_bindgen_futures::JsFuture;
use web_sys::{Request, RequestInit, Response};

/// Returns the SHA-256 digest of the file's canonical body as `0x` hex.
#[wasm_bindgen(js_name = bodyDigest)]
pub fn body_digest(markdown: &str) -> String {
  hex::encode_prefixed(document::body_digest(markdown))
}

/// Returns the exact text `signer` signs with `personal_sign` for this file.
#[wasm_bindgen(js_name = signingMessage)]
pub fn signing_message(markdown: &str, signer: &str) -> String {
  signature::signing_message(signer, &document::body_digest(markdown))
}

/// Reads `{ signer, signature }` from the frontmatter, or `undefined` when
/// the file is not signed.
#[wasm_bindgen(
  js_name = readSignature,
  unchecked_return_type = "{ signer: string; signature: string } | undefined"
)]
pub fn read_signature(markdown: &str) -> Result<JsValue, JsError> {
  let Some(fields) = document::read_signature(markdown) else {
    return Ok(JsValue::UNDEFINED);
  };
  let object = Object::new();
  for (key, value) in
    [("signer", fields.signer), ("signature", fields.signature)]
  {
    Reflect::set(&object, &key.into(), &value.into())
      .map_err(|_| JsError::new("Failed to read the signature"))?;
  }
  Ok(object.into())
}

/// Writes `signer` and `signature` into the frontmatter and returns the new
/// file. The body is left untouched.
#[wasm_bindgen(js_name = writeSignature)]
pub fn write_signature(
  markdown: &str,
  signer: &str,
  signature: &str,
) -> String {
  let fields = SignatureFields {
    signer: signer.to_owned(),
    signature: signature.to_owned(),
  };
  document::write_signature(markdown, &fields)
}

/// Removes `signer` and `signature` from the frontmatter and returns the new
/// file.
#[wasm_bindgen(js_name = removeSignature)]
pub fn remove_signature(markdown: &str) -> String {
  document::remove_signature(markdown)
}

/// Returns the checksummed address that signed the file per its
/// frontmatter, or `undefined` when the file is not signed.
///
/// Throws when the signature is malformed. This does not look up the ENS
/// name; compare the result with the name's address to verify.
#[wasm_bindgen(js_name = recoverSigner)]
pub fn recover_signer(markdown: &str) -> Result<Option<String>, JsError> {
  let Some(fields) = document::read_signature(markdown) else {
    return Ok(None);
  };
  let digest = document::body_digest(markdown);
  let address = signature::recover(&fields.signature, &fields.signer, &digest)
    .map_err(|_| JsError::new("The signature is malformed"))?;
  Ok(Some(address.to_checksum(None)))
}

/// Verifies the file against ENSv2 on Sepolia, sending `eth_call` to
/// `rpcUrl` with `fetch`.
///
/// Resolves to `{ kind, signer?, address?, reason? }`, where `kind` is
/// `unsigned`, `tampered`, `unauthorized`, or `verified`. With a
/// `trustedParent`, only that name and its subnames verify. Rejects with a
/// generic error when the node cannot be reached or answers badly.
#[wasm_bindgen(
  js_name = verify,
  unchecked_return_type = "{ kind: \"unsigned\" } | { kind: \"tampered\"; signer: string } | { kind: \"unauthorized\"; signer: string; reason: string } | { kind: \"verified\"; signer: string; address: string }"
)]
pub async fn verify(
  markdown: String,
  #[wasm_bindgen(js_name = trustedParent)] trusted_parent: Option<String>,
  #[wasm_bindgen(js_name = rpcUrl)] rpc_url: String,
) -> Result<JsValue, JsError> {
  let caller = FetchCaller { url: rpc_url };
  let verdict = verify::verify(&markdown, trusted_parent.as_deref(), &caller)
    .await
    .map_err(|_| JsError::new("Could not check the name on Sepolia"))?;
  let fields: Vec<(&str, String)> = match verdict {
    Verdict::Unsigned => vec![("kind", "unsigned".to_owned())],
    Verdict::Tampered { signer } => {
      vec![("kind", "tampered".to_owned()), ("signer", signer)]
    }
    Verdict::Unauthorized { signer, reason } => vec![
      ("kind", "unauthorized".to_owned()),
      ("signer", signer),
      ("reason", reason.to_string()),
    ],
    Verdict::Verified { signer, address } => vec![
      ("kind", "verified".to_owned()),
      ("signer", signer),
      ("address", address.to_checksum(None)),
    ],
  };
  let object = Object::new();
  for (key, value) in fields {
    Reflect::set(&object, &key.into(), &value.into())
      .map_err(|_| JsError::new("Failed to build the verdict"))?;
  }
  Ok(object.into())
}

/// Reads the document published under `name` from its `mdtp` text record,
/// sending JSON-RPC to `rpcUrl` with `fetch`, and judges it.
///
/// Resolves to `{ name, verdict, txHash?, publisher, from, markdown,
/// timestamp }`, where `verdict` is `notFound`, `tampered`, `unauthorized`,
/// or `verified` and `timestamp` is the block's Unix time in seconds. Rejects
/// with a generic error when the node cannot be reached or the name is not
/// a `.eth` name.
#[wasm_bindgen(
  js_name = read,
  unchecked_return_type = "{ name: string; verdict: \"notFound\" | \"tampered\" | \"unauthorized\" | \"verified\"; txHash?: string; publisher: string; from: string; markdown: string; timestamp: number }"
)]
pub async fn read(
  name: String,
  #[wasm_bindgen(js_name = rpcUrl)] rpc_url: String,
) -> Result<JsValue, JsError> {
  let caller = FetchCaller { url: rpc_url };
  let published = publish::read(&name, &caller)
    .await
    .map_err(|_| JsError::new("Could not read the name on Sepolia"))?;
  let verdict = match published.verdict {
    PublishVerdict::NotFound => "notFound",
    PublishVerdict::Tampered => "tampered",
    PublishVerdict::Unauthorized => "unauthorized",
    PublishVerdict::Verified => "verified",
  };
  let object = Object::new();
  let mut fields: Vec<(&str, JsValue)> = vec![
    ("name", published.name.into()),
    ("verdict", verdict.into()),
    ("publisher", published.publisher.into()),
    ("from", published.from.to_checksum(None).into()),
    ("markdown", published.markdown.into()),
    // Block timestamps fit a JavaScript number for millions of years.
    ("timestamp", (published.timestamp as f64).into()),
  ];
  if let Some(tx_hash) = published.tx_hash {
    fields.push(("txHash", tx_hash.to_string().into()));
  }
  for (key, value) in fields {
    Reflect::set(&object, &key.into(), &value)
      .map_err(|_| JsError::new("Failed to build the document"))?;
  }
  Ok(object.into())
}

#[wasm_bindgen]
extern "C" {
  /// The global `fetch`, present in browsers, workers, and Deno alike.
  #[wasm_bindgen(js_name = fetch)]
  fn global_fetch(request: &Request) -> Promise;
}

/// Sends JSON-RPC requests over the global `fetch`.
struct FetchCaller {
  url: String,
}

impl EthCaller for FetchCaller {
  async fn call(&self, call: &EthCall) -> anyhow::Result<Vec<u8>> {
    publish::eth_call(self, call).await
  }
}

impl JsonRpc for FetchCaller {
  async fn request(
    &self,
    method: &str,
    params: Value,
  ) -> anyhow::Result<Value> {
    let body = json!({
      "jsonrpc": "2.0",
      "id": 1,
      "method": method,
      "params": params,
    });
    let init = RequestInit::new();
    init.set_method("POST");
    init.set_body(&body.to_string().into());
    let request = Request::new_with_str_and_init(&self.url, &init)
      .map_err(|_| anyhow!("Invalid RPC URL"))?;
    request
      .headers()
      .set("content-type", "application/json")
      .map_err(|_| anyhow!("Failed to set a header"))?;
    let response: Response = JsFuture::from(global_fetch(&request))
      .await
      .map_err(|_| anyhow!("The node is unreachable"))?
      .dyn_into()
      .map_err(|_| anyhow!("fetch did not return a Response"))?;
    if !response.ok() {
      bail!("The node answered with HTTP {}", response.status());
    }
    let text = response.text().map_err(|_| anyhow!("No body"))?;
    let text = JsFuture::from(text)
      .await
      .map_err(|_| anyhow!("The node's answer is unreadable"))?
      .as_string()
      .ok_or_else(|| anyhow!("The node's answer is not text"))?;
    let mut answer: Value = serde_json::from_str(&text)
      .map_err(|_| anyhow!("The node's answer is not JSON"))?;
    if answer.get("error").is_some() {
      bail!("The node answered with an error");
    }
    answer
      .get_mut("result")
      .map(Value::take)
      .ok_or_else(|| anyhow!("The node's answer has no result"))
  }
}
