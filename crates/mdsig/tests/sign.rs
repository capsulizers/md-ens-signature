//! Runs `mdsig sign`, then `mdsig inspect` on what it wrote.

use std::fs;
use std::path::Path;

use assert_cmd::Command;
use tempfile::TempDir;

const KEY: &str =
  "0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318";
const ADDRESS: &str = "0x2c7536E3605D9C16a7a3D7b1898e529396a65c23";
const BODY: &str = "---\ntitle: Note\n---\n# Note\n\nBuy low, sell high.\n";

fn mdsig() -> anyhow::Result<Command> {
  let mut command = Command::cargo_bin("mdsig")?;
  command.env_remove("MDSIG_PRIVATE_KEY");
  Ok(command)
}

fn sign(path: &Path) -> anyhow::Result<String> {
  let output = mdsig()?
    .args(["sign", "--signer", "Bob.Alice.eth"])
    .arg(path)
    .env("MDSIG_PRIVATE_KEY", KEY)
    .output()?;
  assert!(output.status.success());
  Ok(String::from_utf8(output.stdout)?)
}

fn inspect(path: &Path) -> anyhow::Result<(Option<i32>, String)> {
  let output = mdsig()?.arg("inspect").arg(path).output()?;
  Ok((output.status.code(), String::from_utf8(output.stdout)?))
}

#[test]
fn sign_then_inspect_round_trips() -> anyhow::Result<()> {
  let dir = TempDir::new()?;
  let path = dir.path().join("note.md");
  fs::write(&path, BODY)?;
  let signed = sign(&path)?;
  assert!(signed.contains("signer: bob.alice.eth\n"), "{signed}");
  assert!(
    signed.contains(&format!("address: {ADDRESS}\n")),
    "{signed}"
  );

  let markdown = fs::read_to_string(&path)?;
  assert!(markdown.starts_with("---\ntitle: Note\nsigner: bob.alice.eth\n"));
  let (code, inspected) = inspect(&path)?;
  assert_eq!(code, Some(0));
  assert!(inspected.contains(&format!("recovered address: {ADDRESS}\n")));
  Ok(())
}

#[test]
fn editing_the_body_changes_the_recovered_address() -> anyhow::Result<()> {
  let dir = TempDir::new()?;
  let path = dir.path().join("note.md");
  fs::write(&path, BODY)?;
  sign(&path)?;
  let edited = fs::read_to_string(&path)?.replace("sell high", "sell higher");
  fs::write(&path, edited)?;
  let (code, inspected) = inspect(&path)?;
  assert_eq!(code, Some(0));
  assert!(inspected.contains("recovered address: 0x"), "{inspected}");
  assert!(!inspected.contains(ADDRESS), "{inspected}");
  Ok(())
}

#[test]
fn output_leaves_the_input_untouched() -> anyhow::Result<()> {
  let dir = TempDir::new()?;
  let input = dir.path().join("note.md");
  let output = dir.path().join("signed.md");
  fs::write(&input, BODY)?;
  mdsig()?
    .args([
      "sign",
      "--signer",
      "bob.alice.eth",
      "--key-env",
      "OTHER_KEY",
    ])
    .arg(&input)
    .arg("--output")
    .arg(&output)
    .env("OTHER_KEY", KEY)
    .assert()
    .success();
  assert_eq!(fs::read_to_string(&input)?, BODY);
  assert_eq!(inspect(&output)?.0, Some(0));
  Ok(())
}

#[test]
fn missing_or_bad_key_fails_without_writing() -> anyhow::Result<()> {
  let dir = TempDir::new()?;
  let path = dir.path().join("note.md");
  fs::write(&path, BODY)?;
  let args = ["sign", "--signer", "bob.alice.eth"];
  mdsig()?.args(args).arg(&path).assert().code(1);
  mdsig()?
    .args(args)
    .arg(&path)
    .env("MDSIG_PRIVATE_KEY", "0x1234")
    .assert()
    .code(1);
  assert_eq!(fs::read_to_string(&path)?, BODY);
  Ok(())
}
