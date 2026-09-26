//! Name systems that decide who may publish under a name.
//!
//! A [`NameSystem`] answers who owns a name and reads or writes its text
//! records. [`name_system`] picks one by the name's suffix. ENSv2 on Sepolia
//! ([`Ens`], for `.eth`) is the only one today, so the choice is a function
//! rather than a registry.

use alloy_primitives::Address;
use anyhow::bail;

use crate::ens::{
  EthCall, decode_find_owner, decode_find_resolver, decode_text,
  find_owner_call, find_resolver_call, set_text_call, text_call,
};
use crate::verify::EthCaller;

/// The EIP-155 chain id of Sepolia, where ENSv2 lives today.
pub const SEPOLIA_CHAIN_ID: u64 = 11_155_111;

/// A system of names with owners and text records, living on one chain.
///
/// Every method that needs the network takes an [`EthCaller`], so the
/// library stays sans-IO.
#[allow(async_fn_in_trait)]
pub trait NameSystem {
  /// The EIP-155 chain id that holds the names and published transactions.
  fn chain_id(&self) -> u64;

  /// Returns the owner of `name`, or the zero address when no one owns it,
  /// for instance because its parent revoked it.
  async fn owner<C: EthCaller>(
    &self,
    name: &str,
    caller: &C,
  ) -> anyhow::Result<Address>;

  /// Reads the text record `key` of `name`, or `None` when the name has no
  /// resolver or the record is empty.
  async fn text<C: EthCaller>(
    &self,
    name: &str,
    key: &str,
    caller: &C,
  ) -> anyhow::Result<Option<String>>;

  /// Builds the transaction call that sets the text record `key` of `name`
  /// to `value`. Fails when the name has no resolver.
  async fn set_text<C: EthCaller>(
    &self,
    name: &str,
    key: &str,
    value: &str,
    caller: &C,
  ) -> anyhow::Result<EthCall>;
}

/// ENSv2 on Sepolia, for names ending in `.eth`.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Ens;

impl NameSystem for Ens {
  fn chain_id(&self) -> u64 {
    SEPOLIA_CHAIN_ID
  }

  async fn owner<C: EthCaller>(
    &self,
    name: &str,
    caller: &C,
  ) -> anyhow::Result<Address> {
    let Ok(call) = find_owner_call(name) else {
      return Ok(Address::ZERO);
    };
    decode_find_owner(&caller.call(&call).await?)
  }

  async fn text<C: EthCaller>(
    &self,
    name: &str,
    key: &str,
    caller: &C,
  ) -> anyhow::Result<Option<String>> {
    let found = caller.call(&find_resolver_call(name)?).await?;
    if decode_find_resolver(&found)?.resolver == Address::ZERO {
      return Ok(None);
    }
    let value = decode_text(&caller.call(&text_call(name, key)?).await?)?;
    Ok(Some(value).filter(|value| !value.is_empty()))
  }

  async fn set_text<C: EthCaller>(
    &self,
    name: &str,
    key: &str,
    value: &str,
    caller: &C,
  ) -> anyhow::Result<EthCall> {
    let found = caller.call(&find_resolver_call(name)?).await?;
    let resolver = decode_find_resolver(&found)?.resolver;
    if resolver == Address::ZERO {
      bail!("{name} has no resolver to hold the record");
    }
    Ok(set_text_call(resolver, name, key, value))
  }
}

/// Picks the name system for `name` by its suffix.
///
/// Only `.eth` names, served by [`Ens`], are supported today.
pub fn name_system(name: &str) -> anyhow::Result<impl NameSystem + use<>> {
  let name = name.trim().to_lowercase();
  if name.ends_with(".eth") {
    return Ok(Ens);
  }
  bail!("No name system serves {name}; only .eth names are supported")
}

#[cfg(test)]
mod tests {
  use super::name_system;

  #[test]
  fn name_system_takes_eth_names_only() {
    assert!(name_system("Skills.MDSIG91205.eth").is_ok());
    for name in ["eth", "alice.com", "alice.eth.com", ""] {
      assert!(name_system(name).is_err(), "{name:?}");
    }
  }
}
