//! The ENSv2 side of verification: the `eth_call` that asks Sepolia who owns
//! a name, and decoding its answer.
//!
//! Nothing here talks to a node. [`find_owner_call`] builds the call, the
//! embedder sends it with `eth_call` however it likes, and
//! [`decode_find_owner`] reads the bytes that come back.

use alloy_primitives::{Address, address};
use alloy_sol_types::{SolCall, sol};
use anyhow::{anyhow, bail};

/// The ENSv2 Universal Resolver on Sepolia, the one deployment that exposes
/// `findOwner`.
pub const SEPOLIA_UNIVERSAL_RESOLVER_V2: Address =
  address!("0x85edf8b6b7d4211e2b07aa687506b746357b92cf");

/// The longest label a DNS wire length byte can describe.
const MAX_LABEL_LEN: usize = 255;

sol! {
  /// Returns the address that owns a DNS-encoded name in the ENSv2 registry
  /// tree, or the zero address when no registry holds it.
  function findOwner(bytes dnsName) external view returns (address);
}

/// A read-only contract call for `eth_call`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EthCall {
  /// The contract to call.
  pub to: Address,
  /// The ABI-encoded calldata.
  pub data: Vec<u8>,
}

/// Encodes an ENS name in DNS wire format, as ENS contracts take it.
///
/// The name is trimmed and lowercased, then each dot-separated label becomes
/// its length byte followed by its UTF-8 bytes, and a zero byte ends the name.
/// This is not full ENSIP-15 normalization, only the case folding that
/// signing also applies. An empty name, an empty label, or a label longer than
/// 255 bytes is an error.
pub fn dns_encode(name: &str) -> anyhow::Result<Vec<u8>> {
  let name = name.trim().to_lowercase();
  let mut out = Vec::with_capacity(name.len() + 2);
  for label in name.split('.') {
    if label.is_empty() {
      bail!("The ENS name has an empty label");
    }
    let len = u8::try_from(label.len())
      .map_err(|_| anyhow!("An ENS label is over {MAX_LABEL_LEN} bytes"))?;
    out.push(len);
    out.extend_from_slice(label.as_bytes());
  }
  out.push(0);
  Ok(out)
}

/// Builds the call asking the Sepolia Universal Resolver who owns `name`.
pub fn find_owner_call(name: &str) -> anyhow::Result<EthCall> {
  let dns_name = dns_encode(name)?.into();
  Ok(EthCall {
    to: SEPOLIA_UNIVERSAL_RESOLVER_V2,
    data: findOwnerCall { dnsName: dns_name }.abi_encode(),
  })
}

/// Decodes what `eth_call` returned for a [`find_owner_call`].
///
/// The zero address means the name is not registered, for instance because
/// its parent revoked it.
pub fn decode_find_owner(bytes: &[u8]) -> anyhow::Result<Address> {
  findOwnerCall::abi_decode_returns(bytes)
    .map_err(|_| anyhow!("The findOwner answer is malformed"))
}

#[cfg(test)]
mod tests {
  use super::{
    SEPOLIA_UNIVERSAL_RESOLVER_V2, decode_find_owner, dns_encode,
    find_owner_call,
  };
  use alloy_primitives::{Address, address, hex};

  #[test]
  fn dns_encode_writes_length_prefixed_labels() -> anyhow::Result<()> {
    assert_eq!(dns_encode("bob.alice.eth")?, b"\x03bob\x05alice\x03eth\x00");
    assert_eq!(dns_encode(" Bob.ALICE.eth ")?, dns_encode("bob.alice.eth")?);
    assert_eq!(dns_encode("eth")?, b"\x03eth\x00");
    Ok(())
  }

  #[test]
  fn dns_encode_counts_utf8_bytes() -> anyhow::Result<()> {
    assert_eq!(dns_encode("é.eth")?, "\x02é\x03eth\x00".as_bytes());
    Ok(())
  }

  #[test]
  fn dns_encode_rejects_empty_labels() {
    for name in ["", " ", ".eth", "bob..eth", "bob.eth."] {
      assert!(dns_encode(name).is_err(), "{name:?}");
    }
  }

  #[test]
  fn dns_encode_takes_labels_up_to_255_bytes() -> anyhow::Result<()> {
    let longest = format!("{}.eth", "a".repeat(255));
    assert_eq!(dns_encode(&longest)?[0], 255);
    assert!(dns_encode(&format!("{}.eth", "a".repeat(256))).is_err());
    Ok(())
  }

  #[test]
  fn find_owner_call_matches_viem() -> anyhow::Result<()> {
    // viem's encodeFunctionData for findOwner(packetToBytes("mdsig91205.eth")).
    let expected = hex!(
      "97ad3b3b"
      "0000000000000000000000000000000000000000000000000000000000000020"
      "0000000000000000000000000000000000000000000000000000000000000010"
      "0a6d647369673931323035036574680000000000000000000000000000000000"
    );
    let call = find_owner_call("mdsig91205.eth")?;
    assert_eq!(call.to, SEPOLIA_UNIVERSAL_RESOLVER_V2);
    assert_eq!(call.data, expected);
    Ok(())
  }

  #[test]
  fn decode_find_owner_reads_the_address_word() -> anyhow::Result<()> {
    let alice = address!("0x5D279927926977c28685C184C48fC72e31Bdb7D6");
    let answer =
      hex!("0000000000000000000000005d279927926977c28685c184c48fc72e31bdb7d6");
    assert_eq!(decode_find_owner(&answer)?, alice);
    assert_eq!(decode_find_owner(&[0; 32])?, Address::ZERO);
    Ok(())
  }

  #[test]
  fn decode_find_owner_rejects_short_answers() {
    assert!(decode_find_owner(&[]).is_err());
    assert!(decode_find_owner(&[0; 31]).is_err());
  }
}
