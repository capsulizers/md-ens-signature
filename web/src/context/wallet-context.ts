import { createContext } from "@lit/context";

import type { WalletState } from "#engine";

/** The browser wallet's state and the ways to change it. */
export interface WalletContext {
  /** Whether a browser wallet such as MetaMask is installed. */
  isAvailable: boolean;
  /** The connected account and the wallet's chain. */
  state: WalletState;
  /** Asks the user to connect an account. */
  connect: () => Promise<void>;
  /** Asks the wallet to switch to Sepolia. */
  switchChain: () => Promise<void>;
}

/** Wallet context for Lit consumers. */
export const walletContext = createContext<WalletContext>(Symbol("wallet"));

/** The wallet before a provider is connected. */
export const EMPTY_WALLET_CONTEXT: WalletContext = {
  isAvailable: false,
  state: { account: null, chainId: null },
  connect: (): Promise<void> => Promise.resolve(),
  switchChain: (): Promise<void> => Promise.resolve(),
};
