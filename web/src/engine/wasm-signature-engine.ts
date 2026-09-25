import init, { signingMessage, verify, writeSignature } from "#wasm-pkg";

import type { SignatureEngine, Verdict } from "./signature-engine.ts";

/**
 * Signs and verifies with the Rust library compiled to WebAssembly, which
 * asks ENSv2 on Sepolia who owns the signer name through the RPC endpoint.
 */
export class WasmSignatureEngine implements SignatureEngine {
  #ready: Promise<void> | null = null;

  async verify(
    markdown: string,
    rpcUrl: string,
    parentName: string,
  ): Promise<Verdict> {
    await this.#load();
    try {
      return await verify(markdown, parentName || undefined, rpcUrl);
    } catch {
      return { kind: "unreachable" };
    }
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
    return writeSignature(markdown, signer, signature);
  }

  /** Instantiates the WebAssembly module once, on first use. */
  #load(): Promise<void> {
    this.#ready ??= init().then((): void => {});
    return this.#ready;
  }
}
