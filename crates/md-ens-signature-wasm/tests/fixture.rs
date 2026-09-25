//! Proves that the fixture the JavaScript tests read was signed by the Rust
//! library with the well-known test key.

use alloy_primitives::hex;
use md_ens_signature::document::{
  SignatureFields, body_digest, remove_signature, write_signature,
};
use md_ens_signature::signature::sign;

/// A well-known test key; its address is
/// `0x2c7536E3605D9C16a7a3D7b1898e529396a65c23`.
const KEY: [u8; 32] =
  hex!("4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318");
/// The file the JavaScript tests read.
const SIGNED: &str = include_str!("fixtures/signed.md");

#[test]
fn fixture_is_signed_by_the_test_key() -> anyhow::Result<()> {
  let unsigned = remove_signature(SIGNED);
  let signer = "bob.alice.eth";
  let signature = sign(&KEY, signer, &body_digest(&unsigned))?;
  let fields = SignatureFields {
    signer: signer.to_owned(),
    signature,
  };
  assert_eq!(write_signature(&unsigned, &fields), SIGNED);
  Ok(())
}
