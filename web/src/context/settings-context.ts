import { createContext } from "@lit/context";

import { DEFAULT_PARENT_NAME, DEFAULT_RPC_URL } from "#constants";

/** Where the page reads from and whose members it checks. */
export interface Settings {
  rpcUrl: string;
  parentName: string;
}

/** A change to some of the settings. */
export interface SettingsPatch {
  rpcUrl?: string;
  parentName?: string;
}

/** Settings and the way to change them, provided by the page root. */
export interface SettingsContext {
  settings: Settings;
  updateSettings: (patch: SettingsPatch) => void;
}

/** Settings context for Lit consumers. */
export const settingsContext = createContext<SettingsContext>(
  Symbol("settings"),
);

/** Settings used before a provider is connected. */
export const EMPTY_SETTINGS_CONTEXT: SettingsContext = {
  settings: { rpcUrl: DEFAULT_RPC_URL, parentName: DEFAULT_PARENT_NAME },
  updateSettings: (): void => {},
};
