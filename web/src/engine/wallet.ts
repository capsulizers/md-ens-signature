/** One JSON-RPC request to an injected EIP-1193 wallet. */
interface WalletRequest {
  method: string;
  params?: string[];
}

/** The part of an EIP-1193 provider the page uses. */
interface InjectedWallet {
  request(request: WalletRequest): Promise<string | string[]>;
}

declare global {
  interface Window {
    ethereum?: InjectedWallet;
  }
}

/** Whether a browser wallet such as MetaMask is available. */
export function hasWallet(): boolean {
  return globalThis.window?.ethereum !== undefined;
}

/**
 * Asks the wallet for an account and has it sign `message` with
 * `personal_sign`, returning the 65-byte signature as hex.
 */
export async function signWithWallet(message: string): Promise<string> {
  const wallet = globalThis.window?.ethereum;
  if (wallet === undefined) {
    throw new Error("No browser wallet is available.");
  }
  const accounts = await wallet.request({ method: "eth_requestAccounts" });
  const account = Array.isArray(accounts) ? accounts[0] : undefined;
  if (account === undefined) {
    throw new Error("The wallet returned no account.");
  }
  const signature = await wallet.request({
    method: "personal_sign",
    params: [utf8Hex(message), account],
  });
  if (typeof signature !== "string") {
    throw new Error("The wallet returned no signature.");
  }
  return signature;
}

function utf8Hex(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return `0x${
    Array.from(
      bytes,
      (byte: number): string => byte.toString(16).padStart(2, "0"),
    ).join("")
  }`;
}
