//! The Markdown side of the format: the frontmatter that carries a signature
//! and the body it signs.
//!
//! A signed file starts with a `---` line, lists its keys one per line, and
//! closes the block with the next line that is exactly `---`. Everything after
//! that line is the body. Only top-level `key: value` lines at column 0 are
//! read, so no YAML parser is involved, and every other byte of the file is
//! kept as it is when the signature keys are rewritten.

use std::ops::Range;

use sha2::{Digest, Sha256};

/// The line that opens and closes the frontmatter block.
const FENCE: &str = "---";
/// The frontmatter key holding the signer's ENS name.
const SIGNER_KEY: &str = "signer";
/// The frontmatter key holding the hex signature.
const SIGNATURE_KEY: &str = "signature";

/// The two frontmatter values that make a file signed.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SignatureFields {
  /// The ENS name that signed the body, such as `bob.alice.eth`.
  pub signer: String,
  /// The 65-byte `r || s || v` signature as `0x`-prefixed hex.
  pub signature: String,
}

/// Where the frontmatter block sits inside a file.
struct Frontmatter {
  /// The lines between the two fences, each with its line ending.
  inner: Range<usize>,
  /// The first byte after the closing fence line.
  body_start: usize,
}

/// Finds the frontmatter block, if the file starts with one that is closed.
fn frontmatter(markdown: &str) -> Option<Frontmatter> {
  let mut lines = markdown.split_inclusive('\n');
  let first = lines.next()?;
  if !first.ends_with('\n') || !is_fence(first) {
    return None;
  }
  let mut offset = first.len();
  for line in lines {
    if is_fence(line) {
      return Some(Frontmatter {
        inner: first.len()..offset,
        body_start: offset + line.len(),
      });
    }
    offset += line.len();
  }
  None
}

/// Returns a line without its trailing `\n` or `\r\n`.
fn without_newline(line: &str) -> &str {
  let line = line.strip_suffix('\n').unwrap_or(line);
  line.strip_suffix('\r').unwrap_or(line)
}

/// Tells whether a line is exactly `---`, ignoring its line ending.
fn is_fence(line: &str) -> bool {
  without_newline(line) == FENCE
}

/// Reads the value of a top-level `key: value` line, without quotes.
fn key_value<'a>(line: &'a str, key: &str) -> Option<&'a str> {
  let value = without_newline(line)
    .strip_prefix(key)?
    .strip_prefix(':')?
    .trim_matches([' ', '\t']);
  Some(unquote(value))
}

/// Strips one pair of matching single or double quotes around a value.
fn unquote(value: &str) -> &str {
  for quote in ['"', '\''] {
    if let Some(inner) = value
      .strip_prefix(quote)
      .and_then(|rest| rest.strip_suffix(quote))
    {
      return inner;
    }
  }
  value
}

/// Returns the body: everything after the frontmatter, or the whole file when
/// it has none.
fn body(markdown: &str) -> &str {
  match frontmatter(markdown) {
    Some(block) => &markdown[block.body_start..],
    None => markdown,
  }
}

/// Returns the canonical body that a signature covers.
///
/// This is the body with CRLF line endings turned into LF and trailing spaces,
/// tabs, and newlines at the very end removed, so saving the file with a
/// different line ending or final newline keeps the signature valid.
pub fn canonical_body(markdown: &str) -> String {
  body(markdown)
    .replace("\r\n", "\n")
    .trim_end_matches([' ', '\t', '\n'])
    .to_owned()
}

/// Returns the SHA-256 digest of the canonical body.
pub fn body_digest(markdown: &str) -> [u8; 32] {
  Sha256::digest(canonical_body(markdown).as_bytes()).into()
}

/// Reads the signature fields from the frontmatter.
///
/// Returns `None` unless both `signer` and `signature` are present. Quoted
/// values have their quotes removed. When a key repeats, the first one wins.
pub fn read_signature(markdown: &str) -> Option<SignatureFields> {
  let block = frontmatter(markdown)?;
  let mut signer = None;
  let mut signature = None;
  for line in markdown[block.inner].split_inclusive('\n') {
    if signer.is_none() {
      signer = key_value(line, SIGNER_KEY);
    }
    if signature.is_none() {
      signature = key_value(line, SIGNATURE_KEY);
    }
  }
  Some(SignatureFields {
    signer: signer?.to_owned(),
    signature: signature?.to_owned(),
  })
}

#[cfg(test)]
mod tests {
  use super::{SignatureFields, body_digest, canonical_body, read_signature};

  const SIGNATURE: &str = "0xabc123";

  fn fields() -> SignatureFields {
    SignatureFields {
      signer: "bob.alice.eth".to_owned(),
      signature: SIGNATURE.to_owned(),
    }
  }

  #[test]
  fn file_without_frontmatter_is_all_body() {
    let markdown = "# Title\n\nText\n";
    assert_eq!(canonical_body(markdown), "# Title\n\nText");
    assert_eq!(read_signature(markdown), None);
  }

  #[test]
  fn unclosed_frontmatter_is_all_body() {
    let markdown = "---\nsigner: bob.alice.eth\nText\n";
    assert_eq!(canonical_body(markdown), markdown.trim_end());
    assert_eq!(read_signature(markdown), None);
  }

  #[test]
  fn body_starts_right_after_closing_fence() {
    let markdown = "---\ntitle: A\n---\n# Title\n";
    assert_eq!(canonical_body(markdown), "# Title");
  }

  #[test]
  fn fence_at_end_of_file_leaves_empty_body() {
    assert_eq!(canonical_body("---\ntitle: A\n---"), "");
  }

  #[test]
  fn fence_inside_body_belongs_to_body() {
    let markdown = "---\ntitle: A\n---\nAbove\n---\nBelow\n";
    assert_eq!(canonical_body(markdown), "Above\n---\nBelow");
  }

  #[test]
  fn fence_not_on_first_line_is_body() {
    let markdown = "\n---\nsigner: a.eth\nsignature: 0x1\n---\nText";
    assert_eq!(canonical_body(markdown), markdown);
    assert_eq!(read_signature(markdown), None);
  }

  #[test]
  fn crlf_body_matches_lf_body() {
    let lf = "---\ntitle: A\n---\nOne\nTwo\n";
    let crlf = "---\r\ntitle: A\r\n---\r\nOne\r\nTwo\r\n";
    assert_eq!(canonical_body(crlf), "One\nTwo");
    assert_eq!(body_digest(crlf), body_digest(lf));
  }

  #[test]
  fn trailing_whitespace_does_not_change_digest() {
    let plain = "---\ntitle: A\n---\nText";
    for variant in ["Text\n", "Text \t\n\n", "Text\r\n\r\n", "Text   "] {
      let markdown = format!("---\ntitle: A\n---\n{variant}");
      assert_eq!(body_digest(&markdown), body_digest(plain));
    }
  }

  #[test]
  fn leading_and_inner_whitespace_change_digest() {
    let plain = body_digest("Text");
    assert_ne!(body_digest(" Text"), plain);
    assert_ne!(body_digest("Te xt"), plain);
    assert_ne!(body_digest("Text."), plain);
  }

  #[test]
  fn digest_is_sha256_of_canonical_body() {
    // SHA-256 of the three bytes "abc".
    let expected = [
      0xba, 0x78, 0x16, 0xbf, 0x8f, 0x01, 0xcf, 0xea, 0x41, 0x41, 0x40, 0xde,
      0x5d, 0xae, 0x22, 0x23, 0xb0, 0x03, 0x61, 0xa3, 0x96, 0x17, 0x7a, 0x9c,
      0xb4, 0x10, 0xff, 0x61, 0xf2, 0x00, 0x15, 0xad,
    ];
    assert_eq!(body_digest("---\nsigner: a.eth\n---\nabc\n"), expected);
  }

  #[test]
  fn reads_bare_and_quoted_values() {
    let markdown = "---\nsigner: \"bob.alice.eth\"\nsignature: '0xabc123'\n\
      ---\nText";
    assert_eq!(read_signature(markdown), Some(fields()));
    let bare = "---\nsigner:bob.alice.eth  \nsignature: 0xabc123\n---\n";
    assert_eq!(read_signature(bare), Some(fields()));
  }

  #[test]
  fn reads_crlf_frontmatter() {
    let markdown = "---\r\nsigner: bob.alice.eth\r\nsignature: 0xabc123\r\n\
      ---\r\nText\r\n";
    assert_eq!(read_signature(markdown), Some(fields()));
  }

  #[test]
  fn read_needs_both_keys_at_column_zero() {
    assert_eq!(read_signature("---\nsigner: a.eth\n---\n"), None);
    assert_eq!(read_signature("---\nsignature: 0x1\n---\n"), None);
    let nested = "---\nmeta:\n  signer: a.eth\n  signature: 0x1\n---\n";
    assert_eq!(read_signature(nested), None);
    let similar = "---\nsigners: a.eth\nsignature_old: 0x1\n---\n";
    assert_eq!(read_signature(similar), None);
  }
}
