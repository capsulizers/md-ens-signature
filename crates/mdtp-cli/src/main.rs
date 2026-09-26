//! `mdtp`, the command line tool for Markdown files signed with an ENS name.
//!
//! Results go to standard output. Everything else, such as errors, goes
//! through `tracing` to standard error.

mod inspect;
mod publish;
mod read;
mod rpc;
mod sign;
mod verify;

use std::io::IsTerminal;
use std::process::ExitCode;

use clap::{Parser, Subcommand};
use tracing::error;

/// Sign Markdown files with an ENS name and check their signatures.
#[derive(Parser)]
#[command(version, about)]
struct Cli {
  #[command(subcommand)]
  command: Command,
}

#[derive(Subcommand)]
enum Command {
  Sign(sign::Args),
  Inspect(inspect::Args),
  Verify(verify::Args),
  Publish(publish::Args),
  Read(read::Args),
}

fn main() -> ExitCode {
  tracing_subscriber::fmt()
    .with_writer(std::io::stderr)
    .with_ansi(std::io::stderr().is_terminal())
    .without_time()
    .with_target(false)
    .init();
  let cli = Cli::parse();
  let result = match cli.command {
    Command::Sign(args) => sign::run(&args),
    Command::Inspect(args) => inspect::run(&args),
    Command::Verify(args) => verify::run(&args),
    Command::Publish(args) => publish::run(&args),
    Command::Read(args) => read::run(&args),
  };
  result.unwrap_or_else(|error| {
    error!("{error:#}");
    ExitCode::FAILURE
  })
}
