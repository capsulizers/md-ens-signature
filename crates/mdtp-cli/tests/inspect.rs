//! Runs `mdtp inspect` on signed, unsigned, and malformed files.

use std::fs;
use std::path::Path;

use assert_cmd::Command;
use mdtp::document::{SignatureFields, body_digest, write_signature};
use mdtp::signature::sign;
use tempfile::TempDir;

const KEY: [u8; 32] = [
  0x4c, 0x08, 0x83, 0xa6, 0x91, 0x02, 0x93, 0x7d, 0x62, 0x31, 0x47, 0x1b, 0x5d,
  0xbb, 0x62, 0x04, 0xfe, 0x51, 0x29, 0x61, 0x70, 0x82, 0x79, 0x2a, 0xe4, 0x68,
  0xd0, 0x1a, 0x3f, 0x36, 0x23, 0x18,
];
const ADDRESS: &str = "0x2c7536E3605D9C16a7a3D7b1898e529396a65c23";
const SIGNER: &str = "bob.alice.eth";
const BODY: &str = "# Note\n\nBuy low, sell high.\n";

fn signed_markdown() -> anyhow::Result<String> {
  let signature = sign(&KEY, SIGNER, &body_digest(BODY))?;
  let fields = SignatureFields {
    signer: SIGNER.to_owned(),
    signature,
  };
  Ok(write_signature(BODY, &fields))
}

fn inspect(path: &Path) -> anyhow::Result<(Option<i32>, String)> {
  let output = Command::cargo_bin("mdtp")?
    .arg("inspect")
    .arg(path)
    .output()?;
  Ok((output.status.code(), String::from_utf8(output.stdout)?))
}

#[test]
fn signed_file_recovers_the_signing_address() -> anyhow::Result<()> {
  let dir = TempDir::new()?;
  let path = dir.path().join("note.md");
  fs::write(&path, signed_markdown()?)?;
  let (code, stdout) = inspect(&path)?;
  assert_eq!(code, Some(0));
  assert!(stdout.contains(&format!("signer: {SIGNER}\n")), "{stdout}");
  assert!(stdout.contains(&format!("recovered address: {ADDRESS}\n")));
  Ok(())
}

#[test]
fn edited_body_recovers_another_address() -> anyhow::Result<()> {
  let dir = TempDir::new()?;
  let path = dir.path().join("note.md");
  let edited = signed_markdown()?.replace("sell high", "sell higher");
  fs::write(&path, edited)?;
  let (code, stdout) = inspect(&path)?;
  assert_eq!(code, Some(0));
  assert!(stdout.contains("recovered address: 0x"), "{stdout}");
  assert!(!stdout.contains(ADDRESS), "{stdout}");
  Ok(())
}

#[test]
fn unsigned_file_exits_with_two() -> anyhow::Result<()> {
  let dir = TempDir::new()?;
  let path = dir.path().join("note.md");
  fs::write(&path, BODY)?;
  let (code, stdout) = inspect(&path)?;
  assert_eq!(code, Some(2));
  assert!(stdout.starts_with("body digest: 0x"), "{stdout}");
  Ok(())
}

#[test]
fn malformed_signature_exits_with_one() -> anyhow::Result<()> {
  let dir = TempDir::new()?;
  let path = dir.path().join("note.md");
  fs::write(
    &path,
    format!("---\nsigner: {SIGNER}\nsignature: 0x12\n---\n"),
  )?;
  let (code, _) = inspect(&path)?;
  assert_eq!(code, Some(1));
  Ok(())
}

#[test]
fn missing_file_exits_with_one() -> anyhow::Result<()> {
  let dir = TempDir::new()?;
  let (code, _) = inspect(&dir.path().join("missing.md"))?;
  assert_eq!(code, Some(1));
  Ok(())
}
