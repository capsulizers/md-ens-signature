import { createContext } from "@lit/context";

import {
  MockPermissionsEngine,
  MockRegistry,
  type PermissionsEngine,
  type SignatureEngine,
  WasmSignatureEngine,
} from "#engine";

/** The engines the page signs, verifies, and grants with. */
export interface Engines {
  signature: SignatureEngine;
  permissions: PermissionsEngine;
  /** Bumped after a permission change confirms, so readers check again. */
  revision: number;
  /** Tells every reader that a permission change has confirmed. */
  notifyChanged: () => void;
}

/** Engines context for Lit consumers. */
export const enginesContext = createContext<Engines>(Symbol("engines"));

/** The engines, verifying against Sepolia and granting in a mock registry. */
export function createEngines(notifyChanged: () => void): Engines {
  return {
    signature: new WasmSignatureEngine(),
    permissions: new MockPermissionsEngine(new MockRegistry()),
    revision: 0,
    notifyChanged,
  };
}

/** Engines used before a provider is connected. */
export const EMPTY_ENGINES: Engines = createEngines((): void => {});
