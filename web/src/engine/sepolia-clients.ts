import {
  createPublicClient,
  type Hash,
  http,
  type PublicClient,
  type TransactionReceipt,
} from "viem";

import { WALLET_CHAIN } from "./wallet.ts";

/** One viem client per RPC endpoint, shared by the engines that read. */
export class SepoliaClients {
  #clients = new Map<string, PublicClient>();

  /** The client for `rpcUrl`, created on first use. */
  get(rpcUrl: string): PublicClient {
    let client = this.#clients.get(rpcUrl);
    if (client === undefined) {
      client = createPublicClient({
        chain: WALLET_CHAIN,
        transport: http(rpcUrl),
        batch: { multicall: true },
      });
      this.#clients.set(rpcUrl, client);
    }
    return client;
  }

  /** Waits for a transaction to succeed; throws if it reverts. */
  async confirm(hash: Hash, rpcUrl: string): Promise<TransactionReceipt> {
    const receipt = await this.get(rpcUrl).waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new Error("The transaction reverted.");
    }
    return receipt;
  }
}
