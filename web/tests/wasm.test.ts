import { assertEquals, assertThrows } from "@std/assert";

import {
  bodyDigest,
  initSync,
  readSignature,
  recoverSigner,
  removeSignature,
  signingMessage,
  writeSignature,
} from "#wasm-pkg";

/** The address of the well-known test key that signed the fixture. */
const TEST_ADDRESS = "0x2c7536E3605D9C16a7a3D7b1898e529396a65c23";
/** A file the Rust library signed with the test key as `bob.alice.eth`. */
const SIGNED: string = await Deno.readTextFile(
  new URL(
    "../../crates/md-ens-signature-wasm/tests/fixtures/signed.md",
    import.meta.url,
  ),
);
/** A 65-byte signature that recovers to no one in particular. */
const DUMMY_SIGNATURE = `0x${"11".repeat(64)}1b`;

initSync({
  module: await Deno.readFile(
    new URL(
      "../src/wasm-pkg/md_ens_signature_wasm_bg.wasm",
      import.meta.url,
    ),
  ),
});

Deno.test("digest is SHA-256 of the canonical body", (): void => {
  // SHA-256 of the three bytes "abc".
  const abc =
    "0xba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
  assertEquals(bodyDigest("abc"), abc);
  assertEquals(bodyDigest("---\ntitle: A\n---\r\nabc \r\n\n"), abc);
});

Deno.test("signing message names the lowercase signer", (): void => {
  assertEquals(
    signingMessage("abc", " Bob.Alice.ETH "),
    "Markdown signature\nSigner: bob.alice.eth\nBody SHA-256: " +
      bodyDigest("abc"),
  );
});

Deno.test("write, read, and remove round trip", (): void => {
  const markdown = "---\ntitle: A\n---\nBody\n";
  const signed = writeSignature(markdown, "bob.alice.eth", DUMMY_SIGNATURE);
  assertEquals(readSignature(signed), {
    signer: "bob.alice.eth",
    signature: DUMMY_SIGNATURE,
  });
  assertEquals(bodyDigest(signed), bodyDigest(markdown));
  assertEquals(removeSignature(signed), markdown);
  assertEquals(readSignature(markdown), undefined);
});

Deno.test("recovers the test key from the Rust-signed fixture", (): void => {
  assertEquals(recoverSigner(SIGNED), TEST_ADDRESS);
});

Deno.test("an edited body recovers someone else", (): void => {
  const edited = SIGNED.replace("Hello", "Goodbye");
  assertEquals(recoverSigner(edited)?.length, TEST_ADDRESS.length);
  assertEquals(recoverSigner(edited) === TEST_ADDRESS, false);
});

Deno.test("unsigned files recover nothing", (): void => {
  assertEquals(recoverSigner(removeSignature(SIGNED)), undefined);
});

Deno.test("malformed signatures throw a generic error", (): void => {
  const broken = writeSignature(SIGNED, "bob.alice.eth", "0x1234");
  assertThrows(
    (): void => {
      recoverSigner(broken);
    },
    Error,
    "The signature is malformed",
  );
});
