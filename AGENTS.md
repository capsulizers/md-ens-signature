At the start of every new session, run `damem recall` in the terminal and treat
its output as the context for this repository. If the `damem` command is not
found, read [INSTALL.md](https://github.com/cunarist/damem/blob/main/INSTALL.md)
and follow it before reasoning or responding.

# Introduction

This repository holds the open-source half of Memona's ENS signatures: a Rust
library that signs a Markdown file's body with an ENS name's key and verifies
it against ENSv2, a command line tool around it, and a small web page that runs
the same library compiled to WebAssembly. The Memona plugin that uses the
library lives in its own repository.

# Checks

Before finishing any change, run these from the repository root and leave no
warning behind:

```sh
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

Fix what a lint reports instead of silencing it.

# Common

Land every change as a short pull request with a squash merge. Never
fast-forward and never create a merge commit.

Always think about reducing code rather than adding more. Check whether the
function, type, or constant already exists before writing it, and remove
orphaned files, unused exports, and stale dependencies.

# Rust

The library is sans-IO: it builds Ethereum calls and decodes their answers,
and whoever embeds it performs the request. Keep it free of any runtime, so it
compiles for native targets, `wasm32-unknown-unknown`, and `wasm32-wasip2`.

Use `anyhow` for errors, importing `bail!` and `anyhow!` at module scope. The
command line tool prints its results to standard output; everything else it
says goes through `tracing`, never `eprintln!`.
Write tests as plain `#[test]` functions, since the library has no runtime.
