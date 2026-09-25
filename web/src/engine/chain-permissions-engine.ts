import {
  type Address,
  createPublicClient,
  http,
  parseAbi,
  parseAbiItem,
  type PublicClient,
  toHex,
  zeroAddress,
} from "viem";
import { packetToBytes } from "viem/ens";

import {
  ENSV2_START_BLOCK,
  LOG_BLOCK_RANGE,
  UNIVERSAL_RESOLVER,
} from "#constants";

import type { Member, PermissionsEngine } from "./permissions-engine.ts";
import { WALLET_CHAIN } from "./wallet.ts";

const UNIVERSAL_RESOLVER_ABI = parseAbi([
  "function findOwner(bytes name) view returns (address)",
  "function findExactRegistry(bytes name) view returns (address)",
]);

/** Emitted once, when a registry proxy is initialized. */
const REGISTRY_CREATED = parseAbiItem("event RegistryCreated()");

/** Emitted for every subname a registry registers. */
const LABEL_REGISTERED = parseAbiItem(
  "event LabelRegistered(uint256 indexed tokenId, bytes32 indexed labelHash, string label, address owner, uint64 expiry, address indexed sender)",
);

/**
 * Reads a parent's members straight from ENSv2 on Sepolia. The parent's own
 * UserRegistry lists every label it ever registered in its logs, and
 * `findOwner` says who holds each one now, so nothing is kept locally.
 */
export class ChainPermissionsEngine implements PermissionsEngine {
  #clients = new Map<string, PublicClient>();

  async members(parentName: string, rpcUrl: string): Promise<Member[]> {
    const client = this.#client(rpcUrl);
    const registry = await this.#registry(client, parentName);
    if (registry === null) {
      return [];
    }
    const labels = await this.#labels(client, registry);
    return await Promise.all(
      labels.map(async (label: string): Promise<Member> => {
        const name = `${label}.${parentName}`;
        const owner = await this.#owner(client, name);
        return {
          name,
          label,
          owner,
          status: owner === null ? "REVOKED" : "GRANTED",
        };
      }),
    );
  }

  /** The registry that holds the parent's subnames, or null if none. */
  async #registry(
    client: PublicClient,
    parentName: string,
  ): Promise<Address | null> {
    const registry = await client.readContract({
      address: UNIVERSAL_RESOLVER,
      abi: UNIVERSAL_RESOLVER_ABI,
      functionName: "findExactRegistry",
      args: [dnsEncode(parentName)],
    });
    return registry === zeroAddress ? null : registry;
  }

  /** Who owns `name` now, or null when nobody does. */
  async #owner(client: PublicClient, name: string): Promise<Address | null> {
    const owner = await client.readContract({
      address: UNIVERSAL_RESOLVER,
      abi: UNIVERSAL_RESOLVER_ABI,
      functionName: "findOwner",
      args: [dnsEncode(name)],
    });
    return owner === zeroAddress ? null : owner;
  }

  /**
   * Every label the registry registered, oldest first. Logs are read
   * backwards in the widest range the endpoint allows, stopping at the
   * registry's creation.
   */
  async #labels(client: PublicClient, registry: Address): Promise<string[]> {
    const chunks: string[][] = [];
    let toBlock = await client.getBlockNumber();
    while (toBlock >= ENSV2_START_BLOCK) {
      const fromBlock = maxBlock(toBlock - LOG_BLOCK_RANGE + 1n);
      const logs = await client.getLogs({
        address: registry,
        events: [REGISTRY_CREATED, LABEL_REGISTERED],
        fromBlock,
        toBlock,
      });
      const chunk: string[] = [];
      let isCreated = false;
      for (const log of logs) {
        if (log.eventName === "RegistryCreated") {
          isCreated = true;
        } else if (log.args.label !== undefined) {
          chunk.push(log.args.label);
        }
      }
      chunks.unshift(chunk);
      if (isCreated) {
        break;
      }
      toBlock = fromBlock - 1n;
    }
    return [...new Set(chunks.flat())];
  }

  #client(rpcUrl: string): PublicClient {
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
}

/** A name in the DNS wire format ENSv2 contracts take, as hex. */
export function dnsEncode(name: string): `0x${string}` {
  return toHex(packetToBytes(name));
}

/** The later of `block` and the ENSv2 start block. */
function maxBlock(block: bigint): bigint {
  return block > ENSV2_START_BLOCK ? block : ENSV2_START_BLOCK;
}
