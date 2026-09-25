/**
 * Builds the WebAssembly bindings for the page: compiles
 * `md-ens-signature-wasm` for the browser, then runs `wasm-bindgen` to write
 * the JavaScript module into `src/wasm-pkg`.
 *
 * Needs the `wasm32-unknown-unknown` Rust target and `wasm-bindgen` 0.2.108,
 * the same version the crate pins.
 */

/** The Cargo package that holds the bindings. */
const PACKAGE = "md-ens-signature-wasm";
/** The Rust target the browser runs. */
const TARGET = "wasm32-unknown-unknown";
/** The repository root, where the Cargo workspace lives. */
const ROOT = new URL("../../", import.meta.url);
/** Where `wasm-bindgen` writes the module, relative to the root. */
const OUT_DIR = "web/src/wasm-pkg";

await run("cargo", ["build", "-p", PACKAGE, "--release", "--target", TARGET]);
await run("wasm-bindgen", [
  "--target",
  "web",
  "--out-dir",
  OUT_DIR,
  `target/${TARGET}/release/${PACKAGE.replaceAll("-", "_")}.wasm`,
]);

/** Runs a command from the repository root and exits when it fails. */
async function run(command: string, args: string[]): Promise<void> {
  const output: Deno.CommandOutput = await new Deno.Command(command, {
    args,
    cwd: ROOT,
    stdout: "inherit",
    stderr: "inherit",
  }).output();
  if (!output.success) {
    Deno.exit(output.code);
  }
}
