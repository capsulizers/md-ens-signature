//! The verdict on a signed Markdown file: whether its signature holds and
//! whether ENSv2 still lets the signer sign.
//!
//! [`verify`] runs the whole rule. The one step that needs the network, the
//! `findOwner` lookup, goes through an [`EthCaller`] that the embedder
//! provides, so the library itself stays free of any runtime.

use std::fmt;

use alloy_primitives::Address;

use crate::document::{SignatureFields, body_digest, read_signature};
use crate::ens::{EthCall, decode_find_owner, find_owner_call};
use crate::signature::recover;

/// Sends a read-only `eth_call` to Sepolia and returns the raw answer.
///
/// The method is an `async fn` in the trait, so its future is not required
/// to be `Send`. That is deliberate: a browser implements it with JavaScript
/// `fetch`, whose futures cannot be `Send`, while native code can still
/// implement it with `reqwest` on any runtime. A synchronous host, such as a
/// WASI plugin with a blocking HTTP import, does the request inside the
/// method and drives [`verify`] with any executor, since the future then
/// finishes on its first poll.
#[allow(async_fn_in_trait)]
pub trait EthCaller {
  /// Performs `eth_call` against the latest block and returns its result
  /// bytes.
  async fn call(&self, call: &EthCall) -> anyhow::Result<Vec<u8>>;
}

/// Why a valid signature does not count.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Reason {
  /// No one owns the signer name: it was revoked or never granted.
  Unregistered,
  /// The signer name is not the trusted parent or one of its subnames.
  NotMember {
    /// The trusted parent name.
    parent: String,
  },
}

impl fmt::Display for Reason {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    match self {
      Self::Unregistered => write!(f, "the name is not registered on ENSv2"),
      Self::NotMember { parent } => write!(f, "not a member of {parent}"),
    }
  }
}

/// The outcome of verifying a Markdown file.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Verdict {
  /// The file has no `signer` and `signature` pair.
  Unsigned,
  /// The signature is malformed or was not made by the name's owner, so the
  /// body changed or another key signed it.
  Tampered {
    /// The lowercase signer name the file claims.
    signer: String,
  },
  /// The owner of the name signed the body, but ENSv2 does not let the name
  /// sign now.
  Unauthorized {
    /// The lowercase signer name the file claims.
    signer: String,
    /// Why the signature does not count.
    reason: Reason,
  },
  /// The owner of the signer name signed this exact body.
  Verified {
    /// The lowercase signer name.
    signer: String,
    /// The address that owns the name and made the signature.
    address: Address,
  },
}

/// Verifies a Markdown file's signature against ENSv2 on Sepolia.
///
/// The rule, in order:
///
/// 1. No `signer` and `signature` pair means [`Verdict::Unsigned`].
/// 2. The signature recovers an address over the body digest; a malformed
///    signature means [`Verdict::Tampered`].
/// 3. The Universal Resolver's `findOwner` names the owner of the signer.
/// 4. The zero address means [`Verdict::Unauthorized`], because the name was
///    revoked or never granted. A name that cannot be DNS-encoded is treated
///    the same way, since no one can own it.
/// 5. An owner other than the recovered address means [`Verdict::Tampered`].
/// 6. With a `trusted_parent`, the signer must be that name or end with `.`
///    and that name, else [`Verdict::Unauthorized`].
/// 7. Otherwise the file is [`Verdict::Verified`].
///
/// The owner is read with `findOwner` rather than the name's `addr` record,
/// because a parent's resolver keeps answering for a revoked child through
/// wildcard fallback. Errors come only from the caller, such as an
/// unreachable node or a malformed answer.
pub async fn verify<C: EthCaller>(
  markdown: &str,
  trusted_parent: Option<&str>,
  caller: &C,
) -> anyhow::Result<Verdict> {
  let Some(fields) = read_signature(markdown) else {
    return Ok(Verdict::Unsigned);
  };
  verify_fields(&fields, &body_digest(markdown), trusted_parent, caller).await
}

/// Runs [`verify`] from steps 2 on, for a file whose signature fields and
/// body digest the caller already has.
///
/// Hashing the body is most of the work for a large file, so an embedder
/// that also keys a cache on the digest passes it here instead of having
/// [`verify`] hash the body a second time.
pub async fn verify_fields<C: EthCaller>(
  fields: &SignatureFields,
  body_digest: &[u8; 32],
  trusted_parent: Option<&str>,
  caller: &C,
) -> anyhow::Result<Verdict> {
  let signer = fields.signer.trim().to_lowercase();
  let Ok(recovered) = recover(&fields.signature, &signer, body_digest) else {
    return Ok(Verdict::Tampered { signer });
  };
  let unregistered = Verdict::Unauthorized {
    signer: signer.clone(),
    reason: Reason::Unregistered,
  };
  let Ok(call) = find_owner_call(&signer) else {
    return Ok(unregistered);
  };
  let owner = decode_find_owner(&caller.call(&call).await?)?;
  if owner == Address::ZERO {
    return Ok(unregistered);
  }
  if owner != recovered {
    return Ok(Verdict::Tampered { signer });
  }
  if let Some(parent) = trusted_parent {
    let parent = parent.trim().to_lowercase();
    let member = signer == parent || signer.ends_with(&format!(".{parent}"));
    if !member {
      return Ok(Verdict::Unauthorized {
        signer,
        reason: Reason::NotMember { parent },
      });
    }
  }
  Ok(Verdict::Verified {
    signer,
    address: owner,
  })
}

#[cfg(test)]
mod tests {
  use std::cell::RefCell;
  use std::future::Future;
  use std::pin::pin;
  use std::task::{Context, Poll, Waker};

  use alloy_primitives::{Address, hex};
  use anyhow::{anyhow, bail};

  use super::{EthCaller, Reason, Verdict, verify, verify_fields};
  use crate::document::{
    SignatureFields, body_digest, read_signature, write_signature,
  };
  use crate::ens::{EthCall, find_owner_call};
  use crate::signature::{address_of, sign};

  /// A well-known test key.
  const KEY: [u8; 32] =
    hex!("4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318");
  const OTHER_KEY: [u8; 32] = [7; 32];
  const BODY: &str = "---\ntitle: Note\n---\nBuy low, sell high.\n";
  const SIGNER: &str = "bob.alice.eth";

  /// Answers `findOwner` from a fixed table and records the names asked.
  struct FakeCaller {
    owners: Vec<(&'static str, Address)>,
    asked: RefCell<Vec<Vec<u8>>>,
  }

  impl FakeCaller {
    fn new(owners: Vec<(&'static str, Address)>) -> Self {
      Self {
        owners,
        asked: RefCell::new(Vec::new()),
      }
    }
  }

  impl EthCaller for FakeCaller {
    async fn call(&self, call: &EthCall) -> anyhow::Result<Vec<u8>> {
      self.asked.borrow_mut().push(call.data.clone());
      for (name, owner) in &self.owners {
        if find_owner_call(name)?.data == call.data {
          let mut word = vec![0; 12];
          word.extend_from_slice(owner.as_slice());
          return Ok(word);
        }
      }
      Ok(vec![0; 32])
    }
  }

  /// A caller whose node is down.
  struct DownCaller;

  impl EthCaller for DownCaller {
    async fn call(&self, _: &EthCall) -> anyhow::Result<Vec<u8>> {
      bail!("connection refused")
    }
  }

  /// Runs a future that never waits, as every fake caller's does.
  fn run<T>(future: impl Future<Output = T>) -> anyhow::Result<T> {
    let mut context = Context::from_waker(Waker::noop());
    match pin!(future).poll(&mut context) {
      Poll::Ready(value) => Ok(value),
      Poll::Pending => Err(anyhow!("the future waited")),
    }
  }

  fn signed(key: &[u8; 32], signer: &str) -> anyhow::Result<String> {
    let fields = SignatureFields {
      signer: signer.to_owned(),
      signature: sign(key, signer, &body_digest(BODY))?,
    };
    Ok(write_signature(BODY, &fields))
  }

  fn owned_by_key() -> anyhow::Result<FakeCaller> {
    Ok(FakeCaller::new(vec![(SIGNER, address_of(&KEY)?)]))
  }

  #[test]
  fn unsigned_file_needs_no_lookup() -> anyhow::Result<()> {
    let caller = owned_by_key()?;
    assert_eq!(run(verify(BODY, None, &caller))??, Verdict::Unsigned);
    assert!(caller.asked.borrow().is_empty());
    Ok(())
  }

  #[test]
  fn owner_signature_is_verified() -> anyhow::Result<()> {
    let caller = owned_by_key()?;
    let verdict = run(verify(&signed(&KEY, SIGNER)?, None, &caller))??;
    let expected = Verdict::Verified {
      signer: SIGNER.to_owned(),
      address: address_of(&KEY)?,
    };
    assert_eq!(verdict, expected);
    assert_eq!(*caller.asked.borrow(), [find_owner_call(SIGNER)?.data]);
    Ok(())
  }

  #[test]
  fn known_digest_gives_the_same_verdicts() -> anyhow::Result<()> {
    let caller = owned_by_key()?;
    let good = signed(&KEY, SIGNER)?;
    let edited = good.replace("sell high", "sell higher");
    for markdown in [&good, &edited] {
      let fields = read_signature(markdown).ok_or(anyhow!("unsigned"))?;
      let digest = body_digest(markdown);
      assert_eq!(
        run(verify_fields(&fields, &digest, None, &caller))??,
        run(verify(markdown, None, &caller))??,
      );
    }
    Ok(())
  }

  #[test]
  fn mixed_case_signer_is_verified_lowercase() -> anyhow::Result<()> {
    let caller = owned_by_key()?;
    let markdown = signed(&KEY, "Bob.Alice.ETH")?;
    let verdict = run(verify(&markdown, Some(" Alice.eth "), &caller))??;
    assert!(
      matches!(verdict, Verdict::Verified { signer, .. } if signer == SIGNER)
    );
    Ok(())
  }

  #[test]
  fn edited_body_is_tampered() -> anyhow::Result<()> {
    let caller = owned_by_key()?;
    let edited = signed(&KEY, SIGNER)?.replace("sell high", "sell higher");
    let verdict = run(verify(&edited, None, &caller))??;
    assert_eq!(
      verdict,
      Verdict::Tampered {
        signer: SIGNER.to_owned(),
      }
    );
    Ok(())
  }

  #[test]
  fn another_key_is_tampered() -> anyhow::Result<()> {
    let caller = owned_by_key()?;
    let verdict = run(verify(&signed(&OTHER_KEY, SIGNER)?, None, &caller))??;
    assert_eq!(
      verdict,
      Verdict::Tampered {
        signer: SIGNER.to_owned(),
      }
    );
    Ok(())
  }

  #[test]
  fn malformed_signature_is_tampered_without_lookup() -> anyhow::Result<()> {
    let caller = owned_by_key()?;
    let markdown = format!("---\nsigner: {SIGNER}\nsignature: 0x12\n---\nA");
    let verdict = run(verify(&markdown, None, &caller))??;
    assert_eq!(
      verdict,
      Verdict::Tampered {
        signer: SIGNER.to_owned(),
      }
    );
    assert!(caller.asked.borrow().is_empty());
    Ok(())
  }

  #[test]
  fn unregistered_name_is_unauthorized() -> anyhow::Result<()> {
    let caller = FakeCaller::new(Vec::new());
    let verdict = run(verify(&signed(&KEY, SIGNER)?, None, &caller))??;
    assert_eq!(
      verdict,
      Verdict::Unauthorized {
        signer: SIGNER.to_owned(),
        reason: Reason::Unregistered,
      }
    );
    Ok(())
  }

  #[test]
  fn unencodable_name_is_unauthorized() -> anyhow::Result<()> {
    let caller = owned_by_key()?;
    let verdict = run(verify(&signed(&KEY, "bob..eth")?, None, &caller))??;
    assert_eq!(
      verdict,
      Verdict::Unauthorized {
        signer: "bob..eth".to_owned(),
        reason: Reason::Unregistered,
      }
    );
    Ok(())
  }

  #[test]
  fn name_outside_trusted_parent_is_unauthorized() -> anyhow::Result<()> {
    let caller = owned_by_key()?;
    let markdown = signed(&KEY, SIGNER)?;
    for parent in ["carol.eth", "ice.eth", "bob.alice.eth.x"] {
      let verdict = run(verify(&markdown, Some(parent), &caller))??;
      assert_eq!(
        verdict,
        Verdict::Unauthorized {
          signer: SIGNER.to_owned(),
          reason: Reason::NotMember {
            parent: parent.to_owned(),
          },
        }
      );
    }
    Ok(())
  }

  #[test]
  fn parent_itself_and_its_subnames_are_members() -> anyhow::Result<()> {
    let caller = owned_by_key()?;
    let markdown = signed(&KEY, SIGNER)?;
    for parent in ["alice.eth", "eth", SIGNER] {
      let verdict = run(verify(&markdown, Some(parent), &caller))??;
      assert!(matches!(verdict, Verdict::Verified { .. }), "{parent}");
    }
    Ok(())
  }

  #[test]
  fn unreachable_node_is_an_error() -> anyhow::Result<()> {
    assert!(run(verify(&signed(&KEY, SIGNER)?, None, &DownCaller))?.is_err());
    Ok(())
  }

  #[test]
  fn reasons_read_as_sentences() {
    assert_eq!(
      Reason::NotMember {
        parent: "alice.eth".to_owned(),
      }
      .to_string(),
      "not a member of alice.eth"
    );
  }
}
