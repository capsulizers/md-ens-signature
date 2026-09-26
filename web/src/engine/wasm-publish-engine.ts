import { read } from "#wasm-pkg";

import type { Publication, PublishEngine } from "./publish-engine.ts";
import { loadWasm } from "./wasm-module.ts";

/** Reads published documents with the Rust library compiled to WebAssembly. */
export class WasmPublishEngine implements PublishEngine {
  async read(name: string, rpcUrl: string): Promise<Publication | null> {
    await loadWasm();
    try {
      const document = await read(name, rpcUrl);
      return { ...document, txHash: document.txHash ?? null };
    } catch {
      return null;
    }
  }
}
