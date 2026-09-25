import { createContext } from "@lit/context";

import { MockSignatureEngine, type SignatureEngine } from "#engine";

/** The engines the page signs, verifies, and grants with. */
export interface Engines {
  signature: SignatureEngine;
}

/** Engines context for Lit consumers. */
export const enginesContext = createContext<Engines>(Symbol("engines"));

/** Engines used before a provider is connected. */
export const EMPTY_ENGINES: Engines = {
  signature: new MockSignatureEngine(),
};
