# MDTP: Markdown Transfer Protocol

Version 1, September 2026.

## One name, two guarantees

An ENS name decides who may write a Markdown file. The same name gives two
guarantees, chosen per file:

- **Signed in private.** A local file carries a signature in its frontmatter.
  Any edit to the body, or a signature by anyone but the name's current owner,
  is detected. The file stays wherever it lives and nobody else sees it.
- **Published in public.** An official file is written into one Ethereum
  transaction, and the document name's `mdtp` text record points at it. Nobody
  can forge it, and nobody can delete it.

Both guarantees follow the same ENSv2 membership rules: the owner of a parent
name grants a member a subname, and revoking that subname takes the right away.

The protocol is chain-agnostic by design. A name system is chosen by the name's
suffix, and `.eth` (ENSv2 on Sepolia) is the only one implemented today.

## Local signing

A signed file carries two top-level frontmatter keys:

```md
---
signer: bob.mdsig91205.eth
signature: "0x<65-byte r||s||v, 130 hex digits>"
---

The body.
```

- **Frontmatter** starts at a first line `---` and ends at the next line that is
  exactly `---` (CRLF tolerated). A file without it is unsigned.
- **Canonical body** is everything after the closing line, with CRLF turned into
  LF and trailing spaces, tabs, and newlines at the very end removed. The body
  digest is the SHA-256 of its UTF-8 bytes.
- **Signed message** is EIP-191 `personal_sign` over this exact text, with LF
  line endings and no trailing newline, so any wallet can make it:

```text
Markdown signature
Signer: <signer name, lowercase>
Body SHA-256: 0x<64 lowercase hex digits>
```

- Other frontmatter keys are not signed and are kept byte for byte when a tool
  rewrites `signer` or `signature`. `signature` is written double-quoted,
  `signer` bare; either may be quoted when read.

### Signature verdicts

1. **Unsigned** when there is no `signer` or `signature`.
2. Recover the address from the signature. A malformed signature is
   **Tampered**.
3. Ask ENSv2 who owns the signer name now:
   `UniversalResolverV2.findOwner(dnsEncode(signer))`.
4. The zero address is **Unauthorized**: the name was revoked or never granted.
5. An owner different from the recovered address is **Tampered**: the body
   changed, or another key signed.
6. With a trusted parent `P`, a signer that is neither `P` nor a subname of `P`
   is **Unauthorized**.
7. Otherwise the file is **Verified**, signed by the owner of the signer name.

`resolve(addr)` is not used: ENSv2 resolution walks up to the nearest resolver,
so after a revoke the parent's resolver still answers for the child name.
`findOwner` asks the parent's registry itself.

## Publishing

### The transaction

A publisher sends one Sepolia transaction from its own address to the same
address, with value 0. Its calldata is UTF-8 text:

```text
mdtp/1
publisher: <publisher ENS name, lowercase>

<Markdown bytes, unchanged>
```

One transaction holds up to about 100 KB.

### The record

The publisher then sets the ENS text record `mdtp` of the **document name**,
such as `skills.mdsig91205.eth`, through the `setText` of the resolver that
serves that name:

```text
eip155:11155111:<0x transaction hash>
```

The document name must have a resolver the publisher may write. With a team
`PermissionedResolver`, the parent owner may write it, and may let a member
write only this record with
`authorizeTextRoles(dnsName, "mdtp", account, true)`.

### Reading, with no wallet

1. Resolve the document name's `mdtp` text record through `UniversalResolverV2`
   (`findResolver`, then `resolve` with `text`).
2. `eth_getTransactionByHash` for the recorded hash, then the block's timestamp,
   which is the published time in UTC.
3. Decode the calldata and judge it:

- **Not found** when the name has no resolver, the record is empty, or the
  transaction is unknown or still pending.
- **Tampered** when the record, its chain, or the calldata is not in the format
  above.
- **Verified** when the transaction's sender equals `findOwner(publisher)`, that
  owner is not the zero address, and the publisher may publish the document
  name: it is the name itself, one of its ancestors below the top-level domain,
  or a subname of the name's parent when that parent is not a top-level domain.
  Only `mdsig91205.eth` itself may publish `mdsig91205.eth`.
- **Unauthorized** otherwise, for example after the publisher name is revoked.

### Versions

Every publish sets the record again, so the record's history is the document's
history. The resolver emits
`TextChanged(bytes32 indexed node, string indexed indexedKey, string key, string value)`
for each `setText`; the versions of a name are those logs with
`node = namehash(name)` and `indexedKey = "mdtp"`, newest first, each dated by
its block's timestamp in UTC. Readers fetch the logs backwards in chunks of
50,000 blocks, down to the ENSv2 deployment block 11,163,403. An older version
is read from its recorded transaction and judged by the same rule as the current
one, and a reader marks it as older.

### Links

A published document links to another as `mdtp://<name>`, such as
`mdtp://skills.mdsig91205.eth`. Readers open it by reading that name. Relative
links inside a published file are not supported in version 1.

### Reading in Memona

Memona 2.0.0-alpha.44 and later open published documents natively. Type
`mdtp://<name>` in a panel's path bar, click an `mdtp://` link in any Markdown
file, or open an `mdtp://` link anywhere in the operating system, which
registers Memona as the scheme's handler. The document shows read-only, with the
verdict, publisher, and published time in its frontmatter row. Reading needs no
wallet or key.

### Media

Only small Markdown goes on chain, up to about 100 KB. Ordinary HTTP images,
video, and links inside the Markdown are allowed and encouraged, and render as
usual. Large files belong on a web server or CDN, which is cheaper and faster
than the chain. A later version may list each linked file's SHA-256 in the
signed Markdown so a swapped file is caught.

## Name systems

Every chain-specific step goes through a `NameSystem`, picked by the name's
suffix:

```rust
pub trait NameSystem {
  /// The EIP-155 chain id that holds the names and published transactions.
  fn chain_id(&self) -> u64;
  /// The owner of `name`, or the zero address when nobody owns it.
  async fn owner<C: EthCaller>(&self, name: &str, caller: &C)
    -> anyhow::Result<Address>;
  /// The text record `key` of `name`, or None without a resolver or value.
  async fn text<C: EthCaller>(&self, name: &str, key: &str, caller: &C)
    -> anyhow::Result<Option<String>>;
  /// The transaction call that sets the text record `key` of `name`.
  async fn set_text<C: EthCaller>(
    &self, name: &str, key: &str, value: &str, caller: &C,
  ) -> anyhow::Result<EthCall>;
}
```

`Ens` implements it for `.eth` names on Sepolia. Supporting another name system
or chain means one more implementation and one more suffix in `name_system`; the
formats and verdicts above stay the same.

## Sepolia deployment

| Contract                 | Address                                      |
| ------------------------ | -------------------------------------------- |
| UniversalResolverV2      | `0x85edf8b6b7d4211e2b07aa687506b746357b92cf` |
| ETHRegistrar             | `0xa4449a0dd2b83007553d9b1d28b583a46a805a30` |
| MockUSDC                 | `0xd3322b29a7bdee707d1684676f149bf41aa3422f` |
| VerifiableFactory        | `0x118bc31a50d559f7015a8da26d54b3b030cdb70f` |
| UserRegistryImpl         | `0x840fa461059862ea466a711e8c98c8de732061c0` |
| PermissionedResolverImpl | `0x7e4b2d59938930168024201752ee5503df402303` |

The demo team `mdsig91205.eth` uses the UserRegistry
`0x01B491f24c5705b346482B402dC8665aCe4583a0` and the resolver
`0xCCb6bEf32EE256498ec3F9B19c6eBa1400cB74d1`.

Live examples, readable from the Read tab:

- [`mdtp://skills.mdsig91205.eth`](mdtp://skills.mdsig91205.eth): the team's
  token-screener skill, **Verified**.
- [`mdtp://welcome.mdsig91205.eth`](mdtp://welcome.mdsig91205.eth): published
  from this page, **Verified**.
- [`mdtp://ghost.mdsig91205.eth`](mdtp://ghost.mdsig91205.eth): claiming a
  publisher name that nobody owns, **Unauthorized**.

## Library API (as merged)

The Rust crate `md-ens-signature` in
[capsulizers/mdtp](https://github.com/capsulizers/mdtp) is sans-IO: it builds
Ethereum calls and decodes their answers, and the embedder sends them. It builds
for native targets, `wasm32-unknown-unknown`, and `wasm32-wasip2`. As a git
dependency:

```toml
md-ens-signature = { git = "https://github.com/capsulizers/mdtp", rev = "0cd0fd5" }
```

```rust
// md_ens_signature::publish
pub const RECORD_KEY: &str = "mdtp";
pub trait JsonRpc {
  // params is a JSON array; returns the `result` member, which may be null.
  // A JSON-RPC `error` comes back as Err.
  async fn request(&self, method: &str, params: serde_json::Value)
    -> anyhow::Result<serde_json::Value>;
}
pub struct RpcRequest { pub method: &'static str, pub params: Value }
// Implements EthCaller in one line from a JsonRpc.
pub async fn eth_call<R: JsonRpc>(rpc: &R, call: &EthCall)
  -> anyhow::Result<Vec<u8>>;
pub fn publish_calldata(publisher: &str, markdown: &str) -> Vec<u8>;
pub fn parse_calldata(input: &[u8]) -> Option<(String, String)>;
pub struct Record { pub chain_id: u64, pub tx_hash: B256 }
pub fn format_record(record: &Record) -> String; // "eip155:11155111:0x..."
pub fn parse_record(value: &str) -> anyhow::Result<Record>;
pub fn set_text_call(resolver: Address, doc_name: &str, value: &str)
  -> EthCall;
pub fn read_record_call(doc_name: &str) -> anyhow::Result<EthCall>;
pub struct Transaction {
  pub from: Address, pub input: Vec<u8>, pub block: Option<u64>,
}
pub fn transaction_request(tx_hash: B256) -> RpcRequest;
pub fn parse_transaction(result: &Value)
  -> anyhow::Result<Option<Transaction>>;
pub fn block_request(block: u64) -> RpcRequest;
pub fn parse_block_timestamp(result: &Value) -> anyhow::Result<u64>;
pub fn may_publish(publisher: &str, doc_name: &str) -> bool;
pub enum PublishVerdict { NotFound, Tampered, Unauthorized, Verified }
pub struct Published {
  pub name: String,          // lowercase document name
  pub verdict: PublishVerdict,
  pub tx_hash: Option<B256>,
  pub publisher: String,     // empty unless the calldata parsed
  pub from: Address,         // zero without a transaction
  pub markdown: String,      // empty unless the calldata parsed
  pub block: u64,            // 0 without a mined transaction
  pub timestamp: u64,        // Unix seconds, UTC
}
// Err only from the caller, or for a name no name system serves.
pub async fn read<C: EthCaller + JsonRpc>(doc_name: &str, caller: &C)
  -> anyhow::Result<Published>;

// md_ens_signature::names
pub const SEPOLIA_CHAIN_ID: u64 = 11_155_111;
pub trait NameSystem { /* above */ }
pub struct Ens;
pub fn name_system(name: &str) -> anyhow::Result<impl NameSystem + use<>>;

// md_ens_signature::ens
pub fn namehash(name: &str) -> B256;
pub struct FoundResolver { pub resolver: Address, pub node: B256 }
pub fn find_resolver_call(name: &str) -> anyhow::Result<EthCall>;
pub fn decode_find_resolver(bytes: &[u8]) -> anyhow::Result<FoundResolver>;
pub fn text_call(name: &str, key: &str) -> anyhow::Result<EthCall>;
pub fn decode_text(bytes: &[u8]) -> anyhow::Result<String>;
pub fn set_text_call(resolver: Address, name: &str, key: &str, value: &str)
  -> EthCall;
```

Signing and verifying keep their existing API: `verify::EthCaller`,
`verify::verify`, `ens::EthCall`, and `ens::find_owner_call`.

The `mdsig` command line tool wraps the same calls:

```sh
mdsig publish <file> --name <document name> --publisher <name> \
  [--key-env VAR] [--rpc URL]
mdsig read <name> [--json] [--rpc URL]
```

`mdsig read` exits 0 for Verified, 2 for Not found, 3 for Unauthorized, and 4
for Tampered.
