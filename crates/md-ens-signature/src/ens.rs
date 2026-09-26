//! The ENSv2 side of verification: the `eth_call` that asks Sepolia who owns
//! a name, and decoding its answer.
//!
//! Nothing here talks to a node. [`find_owner_call`] builds the call, the
//! embedder sends it with `eth_call` however it likes, and
//! [`decode_find_owner`] reads the bytes that come back.

use alloy_primitives::{Address, B256, address, keccak256};
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

  /// Returns the resolver serving a DNS-encoded name, the name's namehash,
  /// and the offset of the name the resolver was found at.
  function findResolver(bytes dnsName)
    external view returns (address resolver, bytes32 node, uint256 offset);

  /// Asks the name's resolver for `data` and returns its answer and address.
  function resolve(bytes dnsName, bytes data)
    external view returns (bytes answer, address resolver);

  /// Reads the text record `key` of `node`.
  function text(bytes32 node, string key) external view returns (string);

  /// Sets the text record `key` of `node` on a resolver.
  function setText(bytes32 node, string key, string value) external;
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

/// Computes the ENS namehash of `name`, after the same trimming and
/// lowercasing as [`dns_encode`].
pub fn namehash(name: &str) -> B256 {
  let name = name.trim().to_lowercase();
  name.rsplit('.').fold(B256::ZERO, |node, label| {
    keccak256([node.as_slice(), keccak256(label).as_slice()].concat())
  })
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

/// The resolver that serves a name, as [`decode_find_resolver`] reads it.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct FoundResolver {
  /// The resolver contract, or the zero address when the name has none.
  pub resolver: Address,
  /// The namehash of the name itself, the node its records live under.
  pub node: B256,
}

/// Builds the call asking the Sepolia Universal Resolver which resolver
/// serves `name`.
pub fn find_resolver_call(name: &str) -> anyhow::Result<EthCall> {
  Ok(EthCall {
    to: SEPOLIA_UNIVERSAL_RESOLVER_V2,
    data: findResolverCall {
      dnsName: dns_encode(name)?.into(),
    }
    .abi_encode(),
  })
}

/// Decodes what `eth_call` returned for a [`find_resolver_call`].
pub fn decode_find_resolver(bytes: &[u8]) -> anyhow::Result<FoundResolver> {
  let found = findResolverCall::abi_decode_returns(bytes)
    .map_err(|_| anyhow!("The findResolver answer is malformed"))?;
  Ok(FoundResolver {
    resolver: found.resolver,
    node: found.node,
  })
}

/// Builds the call reading the text record `key` of `name` through the
/// Sepolia Universal Resolver's `resolve`.
///
/// The call reverts when the name has no resolver, so check
/// [`find_resolver_call`] first to tell a missing name from a node error.
pub fn text_call(name: &str, key: &str) -> anyhow::Result<EthCall> {
  let data = textCall {
    node: namehash(name),
    key: key.to_owned(),
  }
  .abi_encode();
  Ok(EthCall {
    to: SEPOLIA_UNIVERSAL_RESOLVER_V2,
    data: resolveCall {
      dnsName: dns_encode(name)?.into(),
      data: data.into(),
    }
    .abi_encode(),
  })
}

/// Decodes what `eth_call` returned for a [`text_call`], giving the empty
/// string for a record that was never set.
pub fn decode_text(bytes: &[u8]) -> anyhow::Result<String> {
  let answer = resolveCall::abi_decode_returns(bytes)
    .map_err(|_| anyhow!("The resolve answer is malformed"))?
    .answer;
  textCall::abi_decode_returns(&answer)
    .map_err(|_| anyhow!("The text record answer is malformed"))
}

/// Builds the transaction call that sets the text record `key` of `name` to
/// `value` on `resolver`, which the sender must be allowed to write.
pub fn set_text_call(
  resolver: Address,
  name: &str,
  key: &str,
  value: &str,
) -> EthCall {
  EthCall {
    to: resolver,
    data: setTextCall {
      node: namehash(name),
      key: key.to_owned(),
      value: value.to_owned(),
    }
    .abi_encode(),
  }
}

#[cfg(test)]
mod tests {
  use super::{
    FoundResolver, SEPOLIA_UNIVERSAL_RESOLVER_V2, decode_find_owner,
    decode_find_resolver, decode_text, dns_encode, find_owner_call, namehash,
    set_text_call, text_call,
  };
  use alloy_primitives::{Address, U256, address, b256, hex};
  use alloy_sol_types::SolValue;

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

  #[test]
  fn namehash_matches_ens() {
    assert_eq!(
      namehash("eth"),
      b256!("93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae")
    );
    assert_eq!(
      namehash("Foo.ETH"),
      b256!("de9b09fd7c5f901e23a3f19fecc54828e9c848539801e86591bd9801b019f84f")
    );
  }

  #[test]
  fn decode_find_resolver_reads_resolver_and_node() -> anyhow::Result<()> {
    let resolver = address!("0xCCb6bEf32EE256498ec3F9B19c6eBa1400cB74d1");
    let node = namehash("skills.mdsig91205.eth");
    let answer = (resolver, node, U256::from(7)).abi_encode();
    let found = decode_find_resolver(&answer)?;
    assert_eq!(found, FoundResolver { resolver, node });
    assert!(decode_find_resolver(&[0; 64]).is_err());
    Ok(())
  }

  #[test]
  fn text_round_trips_through_resolve() -> anyhow::Result<()> {
    let call = text_call("skills.mdsig91205.eth", "mdtp")?;
    assert_eq!(call.to, SEPOLIA_UNIVERSAL_RESOLVER_V2);
    let inner = "eip155:11155111:0x01".abi_encode();
    let answer = (inner, Address::ZERO).abi_encode_params();
    assert_eq!(decode_text(&answer)?, "eip155:11155111:0x01");
    let empty = (String::new().abi_encode(), Address::ZERO).abi_encode_params();
    assert_eq!(decode_text(&empty)?, "");
    Ok(())
  }

  #[test]
  fn set_text_call_targets_the_resolver() {
    let resolver = address!("0xCCb6bEf32EE256498ec3F9B19c6eBa1400cB74d1");
    let call = set_text_call(resolver, "skills.mdsig91205.eth", "mdtp", "v");
    assert_eq!(call.to, resolver);
    assert_eq!(&call.data[..4], hex!("10f13a8c"));
  }
}
