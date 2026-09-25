//! JavaScript bindings for `md-ens-signature`, compiled to WebAssembly with
//! `wasm-bindgen`.
//!
//! Every function takes the whole Markdown file as a string. Failures throw a
//! JavaScript `Error` with a generic message.

use alloy_primitives::hex;
use js_sys::{Object, Reflect};
use md_ens_signature::document::{self, SignatureFields};
use md_ens_signature::signature;
use wasm_bindgen::prelude::{JsError, JsValue, wasm_bindgen};

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
