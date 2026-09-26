//! The JSON-RPC client every networked command shares.

use anyhow::{Context, anyhow, bail};
use mdtp::ens::EthCall;
use mdtp::publish::{JsonRpc, eth_call};
use mdtp::verify::EthCaller;
use serde_json::{Value, json};

/// The public Sepolia node used when `--rpc` is not given.
pub const DEFAULT_RPC: &str = "https://ethereum-sepolia-rpc.publicnode.com";

/// Sends JSON-RPC requests over HTTP with `reqwest`.
pub struct Rpc {
  client: reqwest::Client,
  url: String,
}

impl Rpc {
  /// Creates a client for the node at `url`.
  pub fn new(url: &str) -> Self {
    Self {
      client: reqwest::Client::new(),
      url: url.to_owned(),
    }
  }
}

impl JsonRpc for Rpc {
  async fn request(
    &self,
    method: &str,
    params: Value,
  ) -> anyhow::Result<Value> {
    let request = json!({
      "jsonrpc": "2.0",
      "id": 1,
      "method": method,
      "params": params,
    });
    let mut response: Value = self
      .client
      .post(&self.url)
      .json(&request)
      .send()
      .await
      .with_context(|| format!("Failed to reach {}", self.url))?
      .error_for_status()?
      .json()
      .await
      .context("The node's answer is not JSON")?;
    if let Some(error) = response.get("error") {
      bail!("{method} failed: {error}");
    }
    response
      .get_mut("result")
      .map(Value::take)
      .ok_or_else(|| anyhow!("The node's answer has no result"))
  }
}

impl EthCaller for Rpc {
  async fn call(&self, call: &EthCall) -> anyhow::Result<Vec<u8>> {
    eth_call(self, call).await
  }
}

/// Runs `future` to completion on a single-threaded runtime.
pub fn block_on<T>(future: impl Future<Output = T>) -> anyhow::Result<T> {
  Ok(
    tokio::runtime::Builder::new_current_thread()
      .enable_all()
      .build()?
      .block_on(future),
  )
}
