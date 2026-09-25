import {
  type Address,
  createWalletClient,
  custom,
  type EIP1193Provider,
  type Hash,
  type Hex,
  stringToHex,
  SwitchChainError,
  type WalletClient,
} from "viem";
import { sepolia } from "viem/chains";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

/** The connected account and the chain the wallet is on. */
export interface WalletState {
  /** The first account the page may use, or null before connecting. */
  account: Address | null;
  /** The wallet's current chain, or null when it has not said. */
  chainId: number | null;
}

/** The chain every transaction and lookup on this page targets. */
export const WALLET_CHAIN = sepolia;

/** The injected EIP-1193 wallet such as MetaMask, or null when absent. */
export function injectedWallet(): EIP1193Provider | null {
  return globalThis.window?.ethereum ?? null;
}

/** Whether a browser wallet such as MetaMask is available. */
export function hasWallet(): boolean {
  return injectedWallet() !== null;
}

/** Reads the account and chain without asking the user anything. */
export async function readWallet(): Promise<WalletState> {
  const client = walletClient();
  const [accounts, chainId] = await Promise.all([
    client.getAddresses(),
    client.getChainId(),
  ]);
  return { account: accounts[0] ?? null, chainId };
}

/** Asks the user to connect an account, then reads the wallet again. */
export async function connectWallet(): Promise<WalletState> {
  await walletClient().requestAddresses();
  return await readWallet();
}

/** Asks the wallet to switch to Sepolia, adding the chain if it lacks it. */
export async function switchToSepolia(): Promise<void> {
  const client = walletClient();
  try {
    await client.switchChain({ id: WALLET_CHAIN.id });
  } catch (error) {
    if (!(error instanceof SwitchChainError)) {
      throw error;
    }
    await client.addChain({ chain: WALLET_CHAIN });
  }
}

/**
 * Asks the wallet for an account and has it sign `message` with
 * `personal_sign`, returning the 65-byte signature as hex.
 */
export async function signWithWallet(message: string): Promise<string> {
  return await walletClient().signMessage({
    account: await walletAccount(),
    message: { raw: stringToHex(message) },
  });
}

/** The wallet's account, asking the user to connect one if needed. */
export async function walletAccount(): Promise<Address> {
  const [account] = await walletClient().requestAddresses();
  if (account === undefined) {
    throw new Error("The wallet returned no account.");
  }
  return account;
}

/** Has the wallet's account send `data` to `to` on Sepolia. */
export async function sendFromWallet(to: Address, data: Hex): Promise<Hash> {
  return await walletClient().sendTransaction({
    account: await walletAccount(),
    chain: WALLET_CHAIN,
    to,
    data,
  });
}

/** A viem client that talks to the injected wallet. */
export function walletClient(): WalletClient {
  const wallet = injectedWallet();
  if (wallet === null) {
    throw new Error("No browser wallet is available.");
  }
  return createWalletClient({ chain: WALLET_CHAIN, transport: custom(wallet) });
}
