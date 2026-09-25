//! `mdsig sign`: sign a file's body for an ENS name and write the signature
//! into its frontmatter.

use std::path::PathBuf;
use std::process::ExitCode;

use alloy_primitives::hex;
use anyhow::{Context, anyhow};
use md_ens_signature::document::{
  SignatureFields, body_digest, write_signature,
};
use md_ens_signature::signature::{address_of, sign};
use tracing::info;

/// Sign a file's body for an ENS name with an Ethereum private key.
///
/// The key is read from an environment variable, never from the command
/// line, so it stays out of shell history and process listings.
#[derive(clap::Args)]
pub struct Args {
  /// The Markdown file to sign.
  file: PathBuf,
  /// The ENS name that signs, such as `bob.alice.eth`.
  #[arg(long)]
  signer: String,
  /// The environment variable holding the `0x` hex private key.
  #[arg(long, default_value = "MDSIG_PRIVATE_KEY")]
  key_env: String,
  /// Where to write the signed file, instead of the input file.
  #[arg(long, short)]
  output: Option<PathBuf>,
}

/// Signs the file, writes it, and prints the signer, address, and digest.
pub fn run(args: &Args) -> anyhow::Result<ExitCode> {
  let key = private_key(&args.key_env)?;
  let markdown = std::fs::read_to_string(&args.file)
    .with_context(|| format!("Failed to read {}", args.file.display()))?;
  let signer = args.signer.trim().to_lowercase();
  let digest = body_digest(&markdown);
  let fields = SignatureFields {
    signature: sign(&key, &signer, &digest)?,
    signer,
  };
  let output = args.output.as_ref().unwrap_or(&args.file);
  std::fs::write(output, write_signature(&markdown, &fields))
    .with_context(|| format!("Failed to write {}", output.display()))?;
  info!("Signed {}", output.display());
  println!("signer: {}", fields.signer);
  println!("address: {}", address_of(&key)?);
  println!("body digest: {}", hex::encode_prefixed(digest));
  Ok(ExitCode::SUCCESS)
}

/// Reads a 32-byte hex private key from an environment variable.
fn private_key(var: &str) -> anyhow::Result<[u8; 32]> {
  let value = std::env::var(var)
    .with_context(|| format!("Set {var} to a 0x hex private key"))?;
  hex::decode_to_array(value.trim())
    .map_err(|_| anyhow!("{var} is not 32 bytes of hex"))
}
