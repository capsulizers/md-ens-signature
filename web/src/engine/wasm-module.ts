import init from "#wasm-pkg";

let ready: Promise<void> | null = null;

/** Instantiates the WebAssembly module once, on first use by any engine. */
export function loadWasm(): Promise<void> {
  ready ??= init().then((): void => {});
  return ready;
}
