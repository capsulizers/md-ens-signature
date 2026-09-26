import {
  type Address,
  getAddress,
  type Hex,
  hexToBytes,
  isHex,
  namehash,
  parseAbi,
  parseAbiItem,
  type PublicClient,
  zeroAddress,
  zeroHash,
} from "viem";

import {
  ENSV2_START_BLOCK,
  LOG_BLOCK_RANGE,
  UNIVERSAL_RESOLVER,
} from "#constants";
import { mayPublish, publishCalldata, read, setRecordCall } from "#wasm-pkg";

import { dnsEncode } from "./chain-permissions-engine.ts";
import type { Transaction } from "./permissions-engine.ts";
import type {
  Publication,
  PublishEngine,
  RecordAccess,
  Version,
} from "./publish-engine.ts";
import type { SepoliaClients } from "./sepolia-clients.ts";
import { sendFromWallet, WALLET_CHAIN, walletAccount } from "./wallet.ts";
import { loadWasm } from "./wasm-module.ts";

/** The text record that points a document name at its transaction. */
const RECORD_KEY = "mdtp";

/** What every publishing transaction's calldata starts with. */
const CALLDATA_PREFIX = "mdtp/1\npublisher: ";

const UNIVERSAL_RESOLVER_ABI = parseAbi([
  "function findOwner(bytes name) view returns (address)",
  "function findResolver(bytes name) view returns (address, bytes32, uint256)",
]);

/** Emitted by a resolver for every `setText`. */
const TEXT_CHANGED = parseAbiItem(
  "event TextChanged(bytes32 indexed node, string indexed indexedKey, string key, string value)",
);
/** One `setText` of the `mdtp` record, as its log tells it. */
interface TextChange {
  /** The record value set. */
  value: string;
  /** The block the record was set in. */
  block: bigint;
  /** The transaction that set it. */
  recordTxHash: string;
}

/** What publishing calldata carries after its prefix. */
interface Calldata {
  publisher: string;
  markdown: string;
}

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

  async versions(name: string, rpcUrl: string): Promise<Version[] | null> {
    const client = this.#clients.get(rpcUrl);
    try {
      const [resolver] = await client.readContract({
        address: UNIVERSAL_RESOLVER,
        abi: UNIVERSAL_RESOLVER_ABI,
        functionName: "findResolver",
        args: [dnsEncode(name)],
      });
      if (resolver === zeroAddress) {
        return [];
      }
      const logs = await textChangedLogs(client, resolver, name);
      const times = new Map<bigint, Promise<number>>();
      const versions = logs.map(async (log): Promise<Version> => {
        let time = times.get(log.block);
        if (time === undefined) {
          time = blockTime(client, log.block);
          times.set(log.block, time);
        }
        return {
          txHash: recordTxHash(log.value),
          recordTxHash: log.recordTxHash,
          timestamp: await time,
        };
      });
      return await Promise.all(versions);
    } catch {
      return null;
    }
  }

  async readVersion(
    name: string,
    txHash: string,
    rpcUrl: string,
  ): Promise<Publication | null> {
    await loadWasm();
    const client = this.#clients.get(rpcUrl);
    const publication: Publication = {
      name,
      verdict: "NOT_FOUND",
      txHash,
      publisher: "",
      markdown: "",
      timestamp: 0,
    };
    try {
      const transaction = await client.getTransaction({ hash: hex(txHash) });
      if (transaction.blockNumber === null) {
        return publication;
      }
      publication.timestamp = await blockTime(client, transaction.blockNumber);
      const parsed = parseCalldata(transaction.input);
      if (parsed === null) {
        return { ...publication, verdict: "TAMPERED" };
      }
      const owner = mayPublish(parsed.publisher, name)
        ? await client.readContract({
          address: UNIVERSAL_RESOLVER,
          abi: UNIVERSAL_RESOLVER_ABI,
          functionName: "findOwner",
          args: [dnsEncode(parsed.publisher)],
        })
        : zeroAddress;
      const isOwner = owner !== zeroAddress &&
        getAddress(owner) === getAddress(transaction.from);
      return {
        ...publication,
        ...parsed,
        verdict: isOwner ? "VERIFIED" : "UNAUTHORIZED",
      };
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

/**
 * The resolver's `TextChanged` logs for the `mdtp` record of `name`, newest
 * first, read in the widest block ranges the endpoint allows down to the
 * ENSv2 start block.
 */
async function textChangedLogs(
  client: PublicClient,
  resolver: Address,
  name: string,
): Promise<TextChange[]> {
  const ranges: [bigint, bigint][] = [];
  let toBlock = await client.getBlockNumber();
  while (toBlock >= ENSV2_START_BLOCK) {
    const fromBlock = toBlock - LOG_BLOCK_RANGE + 1n;
    ranges.push([
      fromBlock > ENSV2_START_BLOCK ? fromBlock : ENSV2_START_BLOCK,
      toBlock,
    ]);
    toBlock = fromBlock - 1n;
  }
  const chunks = await Promise.all(
    ranges.map(([fromBlock, toBlock]) =>
      client.getLogs({
        address: resolver,
        event: TEXT_CHANGED,
        args: { node: namehash(name), indexedKey: RECORD_KEY },
        fromBlock,
        toBlock,
      })
    ),
  );
  return chunks.flatMap((logs) =>
    logs.map((log): TextChange => ({
      value: log.args.value ?? "",
      block: log.blockNumber,
      recordTxHash: log.transactionHash,
    })).reverse()
  );
}

/** The Unix time, in seconds, of the block numbered `block`. */
async function blockTime(client: PublicClient, block: bigint): Promise<number> {
  const { timestamp } = await client.getBlock({ blockNumber: block });
  return Number(timestamp);
}

/** The Sepolia transaction an `eip155:<chain>:<hash>` record points at. */
function recordTxHash(record: string): string | null {
  const [namespace, chain, hash] = record.split(":");
  const isSepolia = namespace === "eip155" &&
    chain === String(WALLET_CHAIN.id);
  return isSepolia && hash !== undefined && /^0x[0-9a-fA-F]{64}$/.test(hash)
    ? hash.toLowerCase()
    : null;
}

/**
 * The publisher and Markdown in publishing calldata, or null when it is not
 * `mdtp/1\npublisher: <lowercase name>\n\n<markdown>` in UTF-8.
 */
function parseCalldata(
  input: Hex,
): Calldata | null {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(hexToBytes(input));
  } catch {
    return null;
  }
  if (!text.startsWith(CALLDATA_PREFIX)) {
    return null;
  }
  const rest = text.slice(CALLDATA_PREFIX.length);
  const split = rest.indexOf("\n\n");
  const publisher = split < 0 ? "" : rest.slice(0, split);
  const isValid = publisher !== "" &&
    publisher === publisher.trim().toLowerCase() && !publisher.includes("\n");
  return isValid
    ? { publisher, markdown: rest.slice(split + "\n\n".length) }
    : null;
}
