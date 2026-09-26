//! Runs `mdtp verify`. The offline cases need no node; the live one talks to
//! Sepolia and runs with `cargo test -- --ignored`.

use std::fs;
use std::path::Path;

use assert_cmd::Command;
use tempfile::TempDir;

/// A well-known test key that owns no Sepolia name.
const KEY: &str =
  "0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318";
const BODY: &str = "---\ntitle: Note\n---\n# Note\n\nBuy low, sell high.\n";
/// A demo name that Alice owns on Sepolia.
const PARENT: &str = "mdsig91205.eth";
/// A port nothing listens on, so any lookup fails fast.
const DEAD_RPC: &str = "http://127.0.0.1:9";

fn mdtp() -> anyhow::Result<Command> {
  let mut command = Command::cargo_bin("mdtp")?;
  command.env_remove("MDTP_PRIVATE_KEY");
  Ok(command)
}

fn sign(path: &Path, signer: &str, key: &str) -> anyhow::Result<()> {
  fs::write(path, BODY)?;
  let status = mdtp()?
    .args(["sign", "--signer", signer])
    .arg(path)
    .env("MDTP_PRIVATE_KEY", key)
    .output()?
    .status;
  assert!(status.success());
  Ok(())
}

fn verify(path: &Path, rpc: &str) -> anyhow::Result<(Option<i32>, String)> {
  let output = mdtp()?
    .args(["verify", "--json", "--rpc", rpc])
    .arg(path)
    .output()?;
  Ok((output.status.code(), String::from_utf8(output.stdout)?))
}

#[test]
fn unsigned_file_exits_2_without_a_node() -> anyhow::Result<()> {
  let dir = TempDir::new()?;
  let path = dir.path().join("note.md");
  fs::write(&path, BODY)?;
  let (code, stdout) = verify(&path, DEAD_RPC)?;
  assert_eq!(code, Some(2));
  assert_eq!(stdout, "{\"kind\":\"unsigned\"}\n");
  Ok(())
}

#[test]
fn malformed_signature_exits_4_without_a_node() -> anyhow::Result<()> {
  let dir = TempDir::new()?;
  let path = dir.path().join("note.md");
  fs::write(&path, "---\nsigner: a.eth\nsignature: 0x12\n---\nText\n")?;
  let (code, stdout) = verify(&path, DEAD_RPC)?;
  assert_eq!(code, Some(4));
  assert!(stdout.contains("\"tampered\""), "{stdout}");
  Ok(())
}

#[test]
fn unreachable_node_exits_1() -> anyhow::Result<()> {
  let dir = TempDir::new()?;
  let path = dir.path().join("note.md");
  sign(&path, PARENT, KEY)?;
  let (code, stdout) = verify(&path, DEAD_RPC)?;
  assert_eq!(code, Some(1));
  assert!(stdout.is_empty(), "{stdout}");
  Ok(())
}

/// Checks verdicts against the live demo names on Sepolia. With
/// `SEPOLIA_ALICE_PK` set, it also signs as the name's owner.
#[test]
#[ignore = "talks to Sepolia"]
fn live_sepolia_verdicts() -> anyhow::Result<()> {
  let rpc = "https://ethereum-sepolia-rpc.publicnode.com";
  let dir = TempDir::new()?;
  let path = dir.path().join("note.md");

  sign(&path, PARENT, KEY)?;
  let (code, stdout) = verify(&path, rpc)?;
  assert_eq!(code, Some(4), "someone else's key: {stdout}");

  sign(&path, &format!("carol.{PARENT}"), KEY)?;
  let (code, stdout) = verify(&path, rpc)?;
  assert_eq!(code, Some(3), "an unregistered subname: {stdout}");

  if let Ok(alice) = std::env::var("SEPOLIA_ALICE_PK") {
    sign(&path, PARENT, &alice)?;
    let (code, stdout) = verify(&path, rpc)?;
    assert_eq!(code, Some(0), "the owner's key: {stdout}");
    let edited = fs::read_to_string(&path)?.replace("sell high", "sell 1");
    fs::write(&path, edited)?;
    let (code, stdout) = verify(&path, rpc)?;
    assert_eq!(code, Some(4), "an edited body: {stdout}");
  }
  Ok(())
}
