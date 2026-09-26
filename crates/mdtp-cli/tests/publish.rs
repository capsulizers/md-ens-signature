//! Runs `mdtp publish` and `mdtp read` in the cases that need no node.

use std::fs;

use assert_cmd::Command;
use tempfile::TempDir;

/// A port nothing listens on, so any request fails fast.
const DEAD_RPC: &str = "http://127.0.0.1:9";

fn mdtp() -> anyhow::Result<Command> {
  let mut command = Command::cargo_bin("mdtp")?;
  command.env_remove("MDTP_PRIVATE_KEY");
  Ok(command)
}

#[test]
fn read_fails_on_a_name_no_system_serves() -> anyhow::Result<()> {
  let output = mdtp()?
    .args(["read", "skills.example.com", "--rpc", DEAD_RPC])
    .output()?;
  assert_eq!(output.status.code(), Some(1));
  assert!(output.stdout.is_empty());
  Ok(())
}

#[test]
fn read_fails_when_the_node_is_unreachable() -> anyhow::Result<()> {
  let output = mdtp()?
    .args(["read", "mdsig91205.eth", "--rpc", DEAD_RPC])
    .output()?;
  assert_eq!(output.status.code(), Some(1));
  assert!(output.stdout.is_empty());
  Ok(())
}

#[test]
fn publish_needs_a_key_before_any_request() -> anyhow::Result<()> {
  let dir = TempDir::new()?;
  let path = dir.path().join("note.md");
  fs::write(&path, "# Note\n")?;
  let output = mdtp()?
    .arg("publish")
    .arg(&path)
    .args(["--name", "mdsig91205.eth", "--publisher", "mdsig91205.eth"])
    .args(["--rpc", DEAD_RPC])
    .output()?;
  assert_eq!(output.status.code(), Some(1));
  let stderr = String::from_utf8(output.stderr)?;
  assert!(stderr.contains("MDTP_PRIVATE_KEY"), "{stderr}");
  Ok(())
}
