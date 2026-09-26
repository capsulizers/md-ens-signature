import { defineConfig } from "vite";

import denoJson from "./deno.json" with { type: "json" };

/**
 * The URL path the page is served under. GitHub Pages serves a project site
 * at `/<repository>/`, so a Pages build sets `MDSIG_BASE=/mdtp/`.
 */
const BASE = Deno.env.get("MDSIG_BASE") ?? "/";

export default defineConfig({
  base: BASE,
  clearScreen: false,
  build: {
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        // viem is as large as the rest of the page, so it gets a chunk of its
        // own that browsers cache across page updates.
        manualChunks: { viem: ["viem"] },
      },
    },
  },
  resolve: {
    alias: Object.fromEntries(buildWorkspaceAliases()),
    extensions: [".ts", ".js"],
  },
});

/** Resolves the `#`-prefixed module imports declared in deno.json. */
function buildWorkspaceAliases(): Map<string, string> {
  const base = new URL(".", import.meta.url);
  const aliases = new Map<string, string>();
  for (const [key, value] of Object.entries(denoJson.imports)) {
    if (!key.startsWith("#")) continue;
    aliases.set(key, new URL(value, base).pathname);
  }
  return aliases;
}
