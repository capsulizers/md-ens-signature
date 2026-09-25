# md-ens-signature

Sign Markdown files with an ENS name, and verify them against ENSv2
permissions.

## Try it

Install the `mdsig` command line tool with a Rust toolchain:

```sh
git clone https://github.com/capsulizers/md-ens-signature
cd md-ens-signature
cargo install --path crates/mdsig
```

The example note is unsigned, so `inspect` exits with 2:

```sh
mdsig inspect examples/trading-skill.md
```

Sign it into a new file. The key is a well-known test key that anyone can
use, so never send funds to it. `mdsig` reads keys only from an environment
variable, never from its arguments.

```sh
export MDSIG_PRIVATE_KEY=0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318
mdsig sign examples/trading-skill.md --signer bob.alice.eth --output signed.md
mdsig inspect signed.md
```

`inspect` recovers `0x2c7536E3605D9C16a7a3D7b1898e529396a65c23`, the test
key's address. Change one threshold in the body and inspect again: the
signature now recovers a different address, so the edit shows.

```sh
sed 's/under 30/under 35/' signed.md > edited.md
mdsig inspect edited.md
```

`inspect` works offline. Checking the recovered address against the signer's
ENS name on Sepolia comes with `mdsig verify`.
