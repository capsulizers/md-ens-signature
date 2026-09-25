import { assertEquals, assertRejects, assertThrows } from "@std/assert";

import {
  bodyDigest,
  initSync,
  readSignature,
  recoverSigner,
  removeSignature,
  signingMessage,
  verify,
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
/** Any URL; the tests answer every request themselves. */
const RPC_URL = "https://rpc.invalid/";
/** The Sepolia Universal Resolver V2 that `findOwner` goes to. */
const UNIVERSAL_RESOLVER = "0x85edf8b6b7d4211e2b07aa687506b746357b92cf";
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

/** The part of a JSON-RPC `eth_call` request the tests look at. */
interface RpcRequest {
  method: string;
  params: [CallObject, string];
}

/** The call object of an `eth_call`. */
interface CallObject {
  to: string;
  data: string;
}

/**
 * Runs `body` while the global `fetch` answers every `eth_call` with
 * `owner` as the `findOwner` result, and returns the JSON-RPC requests seen.
 */
async function withOwner(
  owner: string,
  body: () => Promise<void>,
): Promise<RpcRequest[]> {
  const requests: RpcRequest[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
    const request: RpcRequest = await new Request(input).json();
    requests.push(request);
    const word = owner.slice(2).toLowerCase().padStart(64, "0");
    return Response.json({ jsonrpc: "2.0", id: 1, result: `0x${word}` });
  };
  try {
    await body();
  } finally {
    globalThis.fetch = original;
  }
  return requests;
}

Deno.test("verify asks findOwner and matches the owner", async () => {
  const requests = await withOwner(TEST_ADDRESS, async (): Promise<void> => {
    assertEquals(await verify(SIGNED, "alice.eth", RPC_URL), {
      kind: "verified",
      signer: "bob.alice.eth",
      address: TEST_ADDRESS,
    });
  });
  assertEquals(requests[0]?.method, "eth_call");
  assertEquals(requests[0]?.params[0].to.toLowerCase(), UNIVERSAL_RESOLVER);
});

Deno.test("verify reports an unregistered name", async () => {
  await withOwner(`0x${"0".repeat(40)}`, async (): Promise<void> => {
    assertEquals(await verify(SIGNED, undefined, RPC_URL), {
      kind: "unauthorized",
      signer: "bob.alice.eth",
      reason: "the name is not registered on ENSv2",
    });
  });
});

Deno.test("verify reports a name outside the parent", async () => {
  await withOwner(TEST_ADDRESS, async (): Promise<void> => {
    assertEquals(await verify(SIGNED, "carol.eth", RPC_URL), {
      kind: "unauthorized",
      signer: "bob.alice.eth",
      reason: "not a member of carol.eth",
    });
  });
});

Deno.test("verify reports an edited body as tampered", async () => {
  const edited = SIGNED.replace("Hello", "Goodbye");
  await withOwner(TEST_ADDRESS, async (): Promise<void> => {
    assertEquals(await verify(edited, undefined, RPC_URL), {
      kind: "tampered",
      signer: "bob.alice.eth",
    });
  });
});

Deno.test("verify needs no node for an unsigned file", async () => {
  const unsigned = removeSignature(SIGNED);
  const requests = await withOwner(TEST_ADDRESS, async (): Promise<void> => {
    assertEquals(await verify(unsigned, undefined, RPC_URL), {
      kind: "unsigned",
    });
  });
  assertEquals(requests.length, 0);
});

Deno.test("verify rejects generically when the node is down", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (): Promise<Response> =>
    Promise.reject(new TypeError("connection refused"));
  try {
    await assertRejects(
      (): Promise<object> => verify(SIGNED, undefined, RPC_URL),
      Error,
      "Could not check the name on Sepolia",
    );
  } finally {
    globalThis.fetch = original;
  }
});
