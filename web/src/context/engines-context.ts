import { createContext } from "@lit/context";

import {
  ChainPermissionsEngine,
  ChainTeamEngine,
  type PermissionsEngine,
  type PublishEngine,
  SepoliaClients,
  type SignatureEngine,
  type TeamEngine,
  WasmPublishEngine,
  WasmSignatureEngine,
} from "#engine";

/** The engines the page signs, verifies, grants, and reads with. */
export interface Engines {
  signature: SignatureEngine;
  permissions: PermissionsEngine;
  team: TeamEngine;
  publish: PublishEngine;
  /** Bumped after a permission change confirms, so readers check again. */
  revision: number;
  /** Tells every reader that a permission change has confirmed. */
  notifyChanged: () => void;
}

/** Engines context for Lit consumers. */
export const enginesContext = createContext<Engines>(Symbol("engines"));

/** The engines: members come from Sepolia, signatures from WebAssembly. */
export function createEngines(notifyChanged: () => void): Engines {
  const clients = new SepoliaClients();
  return {
    signature: new WasmSignatureEngine(),
    permissions: new ChainPermissionsEngine(clients),
    team: new ChainTeamEngine(clients),
    publish: new WasmPublishEngine(),
    revision: 0,
    notifyChanged,
  };
}

/** Engines used before a provider is connected. */
export const EMPTY_ENGINES: Engines = createEngines((): void => {});
