//! `mdsig read`: fetch a document published under a name and judge it.

use std::process::ExitCode;

use md_ens_signature::publish::{PublishVerdict, Published, read};
use serde_json::{Value, json};

use crate::rpc::{DEFAULT_RPC, Rpc, block_on};
use crate::verify::{TAMPERED, UNAUTHORIZED};

/// The exit code for a name with nothing published under it.
const NOT_FOUND: u8 = 2;

/// Read the Markdown published under a name, with its verdict.
///
/// Prints the verdict, publisher, sender, transaction, and time, then the
/// Markdown. Exits with 0 when verified, 2 when nothing is published, 3 when
/// unauthorized, 4 when tampered, and 1 on an error such as an unreachable
/// node.
#[derive(clap::Args)]
pub struct Args {
  /// The document name, such as `skills.mdsig91205.eth`.
  name: String,
  /// The Sepolia JSON-RPC endpoint.
  #[arg(long, default_value = DEFAULT_RPC)]
  rpc: String,
  /// Print the document as one JSON object.
  #[arg(long)]
  json: bool,
}

/// Reads the document, prints it, and returns the verdict's exit code.
pub fn run(args: &Args) -> anyhow::Result<ExitCode> {
  let published = block_on(read(&args.name, &Rpc::new(&args.rpc)))??;
  if args.json {
    println!("{}", published_json(&published));
  } else {
    print_text(&published);
  }
  Ok(ExitCode::from(match published.verdict {
    PublishVerdict::Verified => 0,
    PublishVerdict::NotFound => NOT_FOUND,
    PublishVerdict::Unauthorized => UNAUTHORIZED,
    PublishVerdict::Tampered => TAMPERED,
  }))
}

/// The verdict's lowercase name, as both output formats spell it.
fn verdict_name(verdict: PublishVerdict) -> &'static str {
  match verdict {
    PublishVerdict::NotFound => "not found",
    PublishVerdict::Tampered => "tampered",
    PublishVerdict::Unauthorized => "unauthorized",
    PublishVerdict::Verified => "verified",
  }
}

/// Prints the header lines, a blank line, and the Markdown.
fn print_text(published: &Published) {
  println!("{}: {}", verdict_name(published.verdict), published.name);
  if let Some(tx_hash) = published.tx_hash {
    println!("transaction: {tx_hash}");
  }
  if published.block == 0 {
    return;
  }
  if !published.publisher.is_empty() {
    println!("publisher: {}", published.publisher);
  }
  println!("from: {}", published.from);
  println!("block: {}", published.block);
  println!("timestamp: {}", published.timestamp);
  if !published.markdown.is_empty() {
    print!("\n{}", published.markdown);
  }
}

/// Describes the document as a JSON object.
fn published_json(published: &Published) -> Value {
  json!({
    "kind": verdict_name(published.verdict).replace(' ', "_"),
    "name": published.name,
    "txHash": published.tx_hash.map(|hash| hash.to_string()),
    "publisher": published.publisher,
    "from": published.from.to_string(),
    "block": published.block,
    "timestamp": published.timestamp,
    "markdown": published.markdown,
  })
}
