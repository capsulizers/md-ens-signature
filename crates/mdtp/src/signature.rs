//! The EIP-191 side of a signature: the message a signer signs, and signing
//! and recovering it with an Ethereum key.

use alloy_primitives::{Address, B256, Signature, eip191_hash_message, hex};
use anyhow::{anyhow, bail};
use k256::ecdsa::{SigningKey, VerifyingKey};
use k256::elliptic_curve::PrimeField;
use k256::elliptic_curve::ops::{LinearCombination, Reduce};
use k256::elliptic_curve::point::DecompressPoint;
use k256::elliptic_curve::subtle::Choice;
use k256::{AffinePoint, NonZeroScalar, ProjectivePoint, Scalar, U256};

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

/// Recovers the address that made `signature_hex` over the message for
/// `signer` and `body_digest`.
///
/// The signature is 65 bytes of hex, with or without `0x`, and its `v` may be
/// 0, 1, 27, or 28. A signature over a different message recovers a different
/// address rather than failing.
pub fn recover(
  signature_hex: &str,
  signer: &str,
  body_digest: &[u8; 32],
) -> anyhow::Result<Address> {
  let bytes: [u8; 65] = hex::decode_to_array(signature_hex.trim())
    .map_err(|_| anyhow!("The signature is not 65 bytes of hex"))?;
  if ![0, 1, 27, 28].contains(&bytes[64]) {
    bail!("The signature's v byte is not 0, 1, 27, or 28");
  }
  let message = signing_message(signer, body_digest);
  let key = recover_key(&bytes, &eip191_hash_message(message.as_bytes()))
    .ok_or_else(|| anyhow!("Failed to recover the signer"))?;
  Ok(Address::from_public_key(&key))
}

/// Recovers the public key behind `r || s || v` over `prehash` as
/// `r⁻¹ (s R - z G)`, where `R` is the curve point with x-coordinate `r` and
/// the y parity of `v`.
///
/// This is the recovery `k256` performs, minus the signature check it runs
/// on the result. That check re-derives `R` from the key it was just computed
/// from, so it always passes, yet it costs a second multi-scalar
/// multiplication, which nearly doubles the cost of verifying inside a
/// metered WebAssembly host. A high `s` needs no normalizing either: `n - s`
/// with the opposite parity recovers the same key.
fn recover_key(bytes: &[u8; 65], prehash: &B256) -> Option<VerifyingKey> {
  let r = NonZeroScalar::try_from(&bytes[..32]).ok()?;
  let s = NonZeroScalar::try_from(&bytes[32..64]).ok()?;
  let odd = Choice::from(u8::from(matches!(bytes[64], 1 | 28)));
  let big_r: AffinePoint =
    Option::from(AffinePoint::decompress(&r.to_repr(), odd))?;
  let z = <Scalar as Reduce<U256>>::reduce_bytes(&prehash.0.into());
  let r_inv: Scalar = Option::from(r.invert())?;
  let key = ProjectivePoint::lincomb(
    &ProjectivePoint::GENERATOR,
    &-(r_inv * z),
    &big_r.into(),
    &(r_inv * *s),
  );
  VerifyingKey::from_affine(key.to_affine()).ok()
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
  use super::{address_of, recover, sign, signing_message};
  use alloy_primitives::{Address, Signature, U256, address, hex, uint};

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
  fn sign_then_recover_round_trips() -> anyhow::Result<()> {
    let signature = sign(&KEY, "bob.alice.eth", &DIGEST)?;
    assert_eq!(signature.len(), 132);
    assert!(signature.starts_with("0x"));
    assert_eq!(recover(&signature, "bob.alice.eth", &DIGEST)?, ADDRESS);
    Ok(())
  }

  #[test]
  fn signature_matches_viem_personal_sign() -> anyhow::Result<()> {
    assert_eq!(sign(&KEY, "bob.alice.eth", &DIGEST)?, VIEM_SIGNATURE);
    Ok(())
  }

  #[test]
  fn recover_accepts_v_zero_and_one() -> anyhow::Result<()> {
    let signature = sign(&KEY, "bob.alice.eth", &DIGEST)?;
    let (rs, v) = signature.split_at(130);
    let v = if v == "1b" { "00" } else { "01" };
    let lowered = format!("{rs}{v}");
    assert_eq!(recover(&lowered, "bob.alice.eth", &DIGEST)?, ADDRESS);
    Ok(())
  }

  #[test]
  fn tampered_digest_recovers_another_address() -> anyhow::Result<()> {
    let signature = sign(&KEY, "bob.alice.eth", &DIGEST)?;
    let tampered = [0xac; 32];
    assert_ne!(recover(&signature, "bob.alice.eth", &tampered)?, ADDRESS);
    Ok(())
  }

  #[test]
  fn malformed_signatures_are_errors() {
    for bad in [
      "",
      "0x",
      "0xzz",
      "0x1234",
      &format!("0x{}", "00".repeat(66)),
      &format!("0x{}25", "11".repeat(64)),
    ] {
      assert!(recover(bad, "bob.alice.eth", &DIGEST).is_err(), "{bad}");
    }
  }

  /// The order of secp256k1, the `n` that `s` is taken modulo.
  const ORDER: U256 = uint!(
    0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141_U256
  );

  /// Recovers the way `alloy` does, through `k256`'s own recovery.
  fn alloy_recover(signature: &str, digest: &[u8; 32]) -> Option<Address> {
    let bytes: [u8; 65] = hex::decode_to_array(signature).ok()?;
    let message = signing_message("bob.alice.eth", digest);
    Signature::from_raw_array(&bytes)
      .ok()?
      .recover_address_from_msg(message.as_bytes())
      .ok()
  }

  #[test]
  fn recovery_matches_k256_for_either_parity() -> anyhow::Result<()> {
    for seed in 0..32u8 {
      let digest = [seed; 32];
      let signature = sign(&KEY, "bob.alice.eth", &digest)?;
      let (rs, v) = signature.split_at(130);
      for v in [v, if v == "1b" { "1c" } else { "1b" }] {
        let signature = format!("{rs}{v}");
        let ours = recover(&signature, "bob.alice.eth", &digest).ok();
        assert_eq!(ours, alloy_recover(&signature, &digest), "{signature}");
      }
    }
    Ok(())
  }

  #[test]
  fn high_s_recovers_the_same_signer() -> anyhow::Result<()> {
    let signature = sign(&KEY, "bob.alice.eth", &DIGEST)?;
    let bytes: [u8; 65] = hex::decode_to_array(&signature)?;
    let s = U256::from_be_slice(&bytes[32..64]);
    let mut high = bytes;
    high[32..64].copy_from_slice(&(ORDER - s).to_be_bytes::<32>());
    high[64] = if bytes[64] == 27 { 28 } else { 27 };
    let high = hex::encode_prefixed(high);
    assert_eq!(recover(&high, "bob.alice.eth", &DIGEST)?, ADDRESS);
    assert_eq!(alloy_recover(&high, &DIGEST), Some(ADDRESS));
    Ok(())
  }

  #[test]
  fn out_of_range_r_and_s_are_errors() -> anyhow::Result<()> {
    let signature = sign(&KEY, "bob.alice.eth", &DIGEST)?;
    let (r, rest) = signature[2..].split_at(64);
    let (s, v) = rest.split_at(64);
    let zero = "00".repeat(32);
    let order = hex::encode(ORDER.to_be_bytes::<32>());
    // No point on the curve has x = 5.
    let off_curve = format!("{}05", "00".repeat(31));
    for bad in [
      format!("{zero}{s}{v}"),
      format!("{r}{zero}{v}"),
      format!("{order}{s}{v}"),
      format!("{r}{order}{v}"),
      format!("{off_curve}{s}{v}"),
    ] {
      assert!(recover(&bad, "bob.alice.eth", &DIGEST).is_err(), "{bad}");
      assert_eq!(alloy_recover(&bad, &DIGEST), None, "{bad}");
    }
    Ok(())
  }
}
