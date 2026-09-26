//! `mdtp verify`: check a file's signature against ENSv2 on Sepolia.

use std::path::PathBuf;
use std::process::ExitCode;

use anyhow::Context;
use mdtp::verify::{Verdict, verify};
use serde_json::{Value, json};

use crate::rpc::{DEFAULT_RPC, Rpc, block_on};

/// The exit code for a file that carries no signature.
const UNSIGNED: u8 = 2;
/// The exit code for a valid signature that ENSv2 does not allow now.
pub const UNAUTHORIZED: u8 = 3;
/// The exit code for a signature that the name's owner did not make.
pub const TAMPERED: u8 = 4;

/// Verify a file's signature against the signer's ENSv2 name on Sepolia.
///
/// Exits with 0 when verified, 2 when unsigned, 3 when unauthorized, 4 when
/// tampered, and 1 on an error such as an unreachable node.
#[derive(clap::Args)]
pub struct Args {
  /// The Markdown file to verify.
  file: PathBuf,
  /// Only accept this ENS name and its subnames, such as `alice.eth`.
  #[arg(long)]
  parent: Option<String>,
  /// The Sepolia JSON-RPC endpoint.
  #[arg(long, default_value = DEFAULT_RPC)]
  rpc: String,
  /// Print the verdict as one JSON object.
  #[arg(long)]
  json: bool,
}

/// Verifies the file, prints the verdict, and returns its exit code.
pub fn run(args: &Args) -> anyhow::Result<ExitCode> {
  let markdown = std::fs::read_to_string(&args.file)
    .with_context(|| format!("Failed to read {}", args.file.display()))?;
  let rpc = Rpc::new(&args.rpc);
  let verdict = block_on(verify(&markdown, args.parent.as_deref(), &rpc))??;
  if args.json {
    println!("{}", verdict_json(&verdict));
  } else {
    println!("{}", verdict_text(&verdict));
  }
  Ok(ExitCode::from(match verdict {
    Verdict::Verified { .. } => 0,
    Verdict::Unsigned => UNSIGNED,
    Verdict::Unauthorized { .. } => UNAUTHORIZED,
    Verdict::Tampered { .. } => TAMPERED,
  }))
}

/// Describes a verdict in one line.
fn verdict_text(verdict: &Verdict) -> String {
  match verdict {
    Verdict::Unsigned => "unsigned: the file carries no signature".to_owned(),
    Verdict::Tampered { signer } => format!(
      "tampered: {signer}'s owner did not sign this body; it was edited or \
       signed with another key"
    ),
    Verdict::Unauthorized { signer, reason } => {
      format!("unauthorized: {signer} may not sign now: {reason}")
    }
    Verdict::Verified { signer, address } => {
      format!("verified: signed by {signer}, owned by {address}")
    }
  }
}

/// Describes a verdict as a JSON object with a `kind` and its fields.
fn verdict_json(verdict: &Verdict) -> Value {
  match verdict {
    Verdict::Unsigned => json!({ "kind": "unsigned" }),
    Verdict::Tampered { signer } => {
      json!({ "kind": "tampered", "signer": signer })
    }
    Verdict::Unauthorized { signer, reason } => json!({
      "kind": "unauthorized",
      "signer": signer,
      "reason": reason.to_string(),
    }),
    Verdict::Verified { signer, address } => json!({
      "kind": "verified",
      "signer": signer,
      "address": address.to_string(),
    }),
  }
}
