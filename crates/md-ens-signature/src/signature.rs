//! The EIP-191 side of a signature: the message a signer signs, and signing
//! it with an Ethereum key.

use alloy_primitives::{Address, Signature, eip191_hash_message, hex};
use anyhow::anyhow;
use k256::ecdsa::SigningKey;

/// Builds the exact text a signer signs with EIP-191 `personal_sign`.
///
/// The signer name is trimmed and lowercased. Lines end with LF and the text
/// has no trailing newline.
pub fn signing_message(signer: &str, body_digest: &[u8; 32]) -> String {
  format!(
    "Markdown signature\nSigner: {}\nBody SHA-256: 0x{}",
    signer.trim().to_lowercase(),
    hex::encode(body_digest),
  )
}

/// Signs the message for `signer` and `body_digest` the way `personal_sign`
/// does, returning `0x` and 130 hex characters of `r || s || v`, with `v` 27
/// or 28.
///
/// Signing is deterministic (RFC 6979) and needs no randomness.
pub fn sign(
  private_key: &[u8; 32],
  signer: &str,
  body_digest: &[u8; 32],
) -> anyhow::Result<String> {
  let key = signing_key(private_key)?;
  let message = signing_message(signer, body_digest);
  let prehash = eip191_hash_message(message.as_bytes());
  let (signature, recovery_id) = key
    .sign_prehash_recoverable(prehash.as_slice())
    .map_err(|_| anyhow!("Failed to sign the message"))?;
  let signature = Signature::from((signature, recovery_id));
  Ok(hex::encode_prefixed(signature.as_bytes()))
}

/// Derives the Ethereum address of a private key.
pub fn address_of(private_key: &[u8; 32]) -> anyhow::Result<Address> {
  Ok(Address::from_private_key(&signing_key(private_key)?))
}

fn signing_key(private_key: &[u8; 32]) -> anyhow::Result<SigningKey> {
  SigningKey::from_bytes(private_key.into())
    .map_err(|_| anyhow!("Invalid private key"))
}

#[cfg(test)]
mod tests {
  use super::{address_of, sign, signing_message};
  use alloy_primitives::{Address, address, hex};

  const KEY: [u8; 32] =
    hex!("4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318");
  const ADDRESS: Address = address!("2c7536E3605D9C16a7a3D7b1898e529396a65c23");
  const DIGEST: [u8; 32] = [0xab; 32];

  /// What viem's `personal_sign` returns for `KEY` over the same message.
  const VIEM_SIGNATURE: &str = concat!(
    "0xe449562a9b327b22428467aa84ecae56357424aecafcbf4411df58039f142449",
    "4c7cafc97b6b9f6886b21f7664248c36bbfbd9744a8ea3c5c0775d745afd99581c",
  );

  #[test]
  fn message_lowercases_and_trims_the_signer() {
    assert_eq!(
      signing_message("  Bob.Alice.ETH\n", &DIGEST),
      format!(
        "Markdown signature\nSigner: bob.alice.eth\nBody SHA-256: 0x{}",
        "ab".repeat(32),
      ),
    );
  }

  #[test]
  fn address_of_matches_the_known_address() -> anyhow::Result<()> {
    assert_eq!(address_of(&KEY)?, ADDRESS);
    Ok(())
  }

  #[test]
  fn signature_matches_viem_personal_sign() -> anyhow::Result<()> {
    assert_eq!(sign(&KEY, "bob.alice.eth", &DIGEST)?, VIEM_SIGNATURE);
    Ok(())
  }
}
