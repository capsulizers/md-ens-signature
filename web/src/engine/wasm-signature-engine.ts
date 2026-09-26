import { signingMessage, verify, writeSignature } from "#wasm-pkg";

import type { SignatureEngine, Verdict } from "./signature-engine.ts";
import { loadWasm } from "./wasm-module.ts";

/**
 * Signs and verifies with the Rust library compiled to WebAssembly, which
 * asks ENSv2 on Sepolia who owns the signer name through the RPC endpoint.
 */
export class WasmSignatureEngine implements SignatureEngine {
  async verify(
    markdown: string,
    rpcUrl: string,
    parentName: string,
  ): Promise<Verdict> {
    await loadWasm();
    try {
      return await verify(markdown, parentName || undefined, rpcUrl);
    } catch {
      return { kind: "unreachable" };
    }
  }

  async message(markdown: string, signer: string): Promise<string> {
    await loadWasm();
    return signingMessage(markdown, signer);
  }

  async attach(
    markdown: string,
    signer: string,
    signature: string,
  ): Promise<string> {
    await loadWasm();
    return writeSignature(markdown, signer, signature);
  }
}
