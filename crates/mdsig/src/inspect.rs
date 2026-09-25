//! `mdsig inspect`: show a file's signature and who made it, offline.

use std::path::PathBuf;
use std::process::ExitCode;

use alloy_primitives::hex;
use anyhow::Context;
use md_ens_signature::document::{body_digest, read_signature};
use md_ens_signature::signature::recover;
use tracing::warn;

/// The exit code for a file that carries no signature.
const UNSIGNED: u8 = 2;

/// Show a file's signer, signature, body digest, and the address that
/// signed it, without contacting ENS.
///
/// Exits with 0 when the file carries a well-formed signature, 2 when it is
/// unsigned, and 1 when the signature is malformed.
#[derive(clap::Args)]
pub struct Args {
  /// The Markdown file to inspect.
  file: PathBuf,
}

/// Prints what the file's signature says and returns the exit code.
pub fn run(args: &Args) -> anyhow::Result<ExitCode> {
  let markdown = std::fs::read_to_string(&args.file)
    .with_context(|| format!("Failed to read {}", args.file.display()))?;
  let digest = body_digest(&markdown);
  let Some(fields) = read_signature(&markdown) else {
    println!("body digest: {}", hex::encode_prefixed(digest));
    warn!("{} is not signed", args.file.display());
    return Ok(ExitCode::from(UNSIGNED));
  };
  println!("signer: {}", fields.signer);
  println!("signature: {}", fields.signature);
  println!("body digest: {}", hex::encode_prefixed(digest));
  let address = recover(&fields.signature, &fields.signer, &digest)?;
  println!("recovered address: {address}");
  Ok(ExitCode::SUCCESS)
}
