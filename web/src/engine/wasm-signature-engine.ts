import init, {
  readSignature,
  recoverSigner,
  signingMessage,
  writeSignature,
} from "#wasm-pkg";

import type { MockRegistry } from "./mock-registry.ts";
import type { SignatureEngine, Verdict } from "./signature-engine.ts";

/**
 * Signs and verifies with the Rust library compiled to WebAssembly. Looking
 * the signer's name up in ENS is still mocked by the registry: a name with
 * no address yet takes the address of whoever first signs as it here.
 */
export class WasmSignatureEngine implements SignatureEngine {
  #registry: MockRegistry;
  #ready: Promise<void> | null = null;

  constructor(registry: MockRegistry) {
    this.#registry = registry;
  }

  async verify(
    markdown: string,
    _rpcUrl: string,
    parentName: string,
  ): Promise<Verdict> {
    await this.#load();
    const signature = readSignature(markdown);
    if (signature === undefined) {
      return { kind: "unsigned" };
    }
    const signer = signature.signer;
    const address = this.#recover(markdown);
    const expected = this.#registry.address(signer);
    if (address === null || !sameAddress(address, expected)) {
      return { kind: "tampered", signer };
    }
    const status = this.#registry.members(parentName).get(signer);
    return status === "GRANTED"
      ? { kind: "verified", signer, address }
      : { kind: "unauthorized", signer };
  }

  async message(markdown: string, signer: string): Promise<string> {
    await this.#load();
    return signingMessage(markdown, signer);
  }

  async attach(
    markdown: string,
    signer: string,
    signature: string,
  ): Promise<string> {
    await this.#load();
    const signed = writeSignature(markdown, signer, signature);
    const address = this.#recover(signed);
    if (address !== null && this.#registry.address(signer) === null) {
      this.#registry.setAddress(signer, address);
    }
    return signed;
  }

  /** Instantiates the WebAssembly module once, on first use. */
  #load(): Promise<void> {
    this.#ready ??= init().then((): void => {});
    return this.#ready;
  }

  /** The address that signed the file, or null when the signature is bad. */
  #recover(markdown: string): string | null {
    try {
      return recoverSigner(markdown) ?? null;
    } catch {
      return null;
    }
  }
}

function sameAddress(address: string, expected: string | null): boolean {
  return expected !== null && address.toLowerCase() === expected.toLowerCase();
}
