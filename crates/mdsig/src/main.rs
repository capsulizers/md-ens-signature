//! `mdsig`, the command line tool for Markdown files signed with an ENS name.
//!
//! Results go to standard output. Everything else, such as errors, goes
//! through `tracing` to standard error.

mod inspect;

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
  Inspect(inspect::Args),
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
    Command::Inspect(args) => inspect::run(&args),
  };
  result.unwrap_or_else(|error| {
    error!("{error:#}");
    ExitCode::FAILURE
  })
}
