import { type Address, getAddress, type Hex, isHex, zeroHash } from "viem";

import { mayPublish, publishCalldata, read, setRecordCall } from "#wasm-pkg";

import type { Transaction } from "./permissions-engine.ts";
import type {
  Publication,
  PublishEngine,
  RecordAccess,
} from "./publish-engine.ts";
import type { SepoliaClients } from "./sepolia-clients.ts";
import { sendFromWallet, walletAccount } from "./wallet.ts";
import { loadWasm } from "./wasm-module.ts";

/** A contract and the calldata to send it. */
interface ContractCall {
  to: Address;
  data: Hex;
}

/** A contract call as the library returns it, in plain strings. */
interface LibraryCall {
  to: string;
  data: string;
}

/**
 * Publishes and reads documents with the Rust library compiled to
 * WebAssembly, which builds every call; the wallet and viem send them.
 */
export class WasmPublishEngine implements PublishEngine {
  #clients: SepoliaClients;

  constructor(clients: SepoliaClients) {
    this.#clients = clients;
  }

  async read(name: string, rpcUrl: string): Promise<Publication | null> {
    await loadWasm();
    try {
      const document = await read(name, rpcUrl);
      return { ...document, txHash: document.txHash ?? null };
    } catch {
      return null;
    }
  }

  async mayPublish(publisher: string, name: string): Promise<boolean> {
    await loadWasm();
    return mayPublish(publisher, name);
  }

  async recordAccess(
    name: string,
    account: Address,
    rpcUrl: string,
  ): Promise<RecordAccess> {
    await loadWasm();
    let call: ContractCall;
    try {
      call = contractCall(await setRecordCall(name, zeroHash, rpcUrl));
    } catch {
      return "NO_RESOLVER";
    }
    try {
      await this.#clients.get(rpcUrl).call({ account, ...call });
      return "WRITABLE";
    } catch {
      return "DENIED";
    }
  }

  async publish(publisher: string, markdown: string): Promise<Transaction> {
    await loadWasm();
    const data = hex(publishCalldata(publisher, markdown));
    return { hash: await sendFromWallet(await walletAccount(), data) };
  }

  async setRecord(
    name: string,
    published: Transaction,
    rpcUrl: string,
  ): Promise<Transaction> {
    await loadWasm();
    const call = contractCall(
      await setRecordCall(name, published.hash, rpcUrl),
    );
    return { hash: await sendFromWallet(call.to, call.data) };
  }

  async confirm(transaction: Transaction, rpcUrl: string): Promise<void> {
    await this.#clients.confirm(transaction.hash, rpcUrl);
  }
}

/** The `{ to, data }` the library built, typed for viem. */
function contractCall(call: LibraryCall): ContractCall {
  return { to: getAddress(call.to), data: hex(call.data) };
}

/** `value` as viem's hex type, which the library always returns. */
function hex(value: string): Hex {
  if (!isHex(value)) {
    throw new Error("The library returned malformed calldata.");
  }
  return value;
}
