import { createContext } from "@lit/context";

import {
  MockPermissionsEngine,
  MockRegistry,
  MockSignatureEngine,
  type PermissionsEngine,
  type SignatureEngine,
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

/** The mock engines, sharing one registry so a revoke shows in verdicts. */
export function createMockEngines(notifyChanged: () => void): Engines {
  const registry = new MockRegistry();
  return {
    signature: new MockSignatureEngine(registry),
    permissions: new MockPermissionsEngine(registry),
    revision: 0,
    notifyChanged,
  };
}

/** Engines used before a provider is connected. */
export const EMPTY_ENGINES: Engines = createMockEngines((): void => {});
