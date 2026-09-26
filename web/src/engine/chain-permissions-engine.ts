import {
  type Address,
  encodeFunctionData,
  type Hex,
  labelhash,
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
  MEMBER_DURATION_SECONDS,
  UNIVERSAL_RESOLVER,
} from "#constants";

import type {
  Member,
  PermissionsEngine,
  Transaction,
} from "./permissions-engine.ts";
import type { SepoliaClients } from "./sepolia-clients.ts";
import { sendFromWallet } from "./wallet.ts";

const UNIVERSAL_RESOLVER_ABI = parseAbi([
  "function findOwner(bytes name) view returns (address)",
  "function findExactRegistry(bytes name) view returns (address)",
]);

const USER_REGISTRY_ABI = parseAbi([
  "function register(string label, address owner, address registry, address resolver, uint256 roleBitmap, uint64 expiry) returns (uint256)",
  "function unregister(uint256 anyId)",
  "function hasRootRoles(uint256 roleBitmap, address account) view returns (bool)",
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
 * Granting registers a label owned by the member with no roles, so only the
 * parent's owner, or an account it gave the unregister role, can take it back.
 */
export class ChainPermissionsEngine implements PermissionsEngine {
  #clients: SepoliaClients;

  constructor(clients: SepoliaClients) {
    this.#clients = clients;
  }

  async members(parentName: string, rpcUrl: string): Promise<Member[]> {
    const client = this.#clients.get(rpcUrl);
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

  owner(name: string, rpcUrl: string): Promise<Address | null> {
    return this.#owner(this.#clients.get(rpcUrl), name);
  }

  async hasRootRoles(
    parentName: string,
    roleBitmap: bigint,
    account: Address,
    rpcUrl: string,
  ): Promise<boolean> {
    const client = this.#clients.get(rpcUrl);
    const registry = await this.#registry(client, parentName);
    if (registry === null) {
      return false;
    }
    return await client.readContract({
      address: registry,
      abi: USER_REGISTRY_ABI,
      functionName: "hasRootRoles",
      args: [roleBitmap, account],
    });
  }

  async grant(
    parentName: string,
    label: string,
    member: Address,
    rpcUrl: string,
  ): Promise<Transaction> {
    const expiry = BigInt(Math.floor(Date.now() / 1000)) +
      MEMBER_DURATION_SECONDS;
    const data = encodeFunctionData({
      abi: USER_REGISTRY_ABI,
      functionName: "register",
      args: [label, member, zeroAddress, zeroAddress, 0n, expiry],
    });
    return await this.#send(parentName, rpcUrl, data);
  }

  async revoke(
    parentName: string,
    label: string,
    rpcUrl: string,
  ): Promise<Transaction> {
    const data = encodeFunctionData({
      abi: USER_REGISTRY_ABI,
      functionName: "unregister",
      args: [BigInt(labelhash(label))],
    });
    return await this.#send(parentName, rpcUrl, data);
  }

  async confirm(transaction: Transaction, rpcUrl: string): Promise<void> {
    await this.#clients.confirm(transaction.hash, rpcUrl);
  }

  /** Sends one call to the parent's registry from the wallet's account. */
  async #send(
    parentName: string,
    rpcUrl: string,
    data: Hex,
  ): Promise<Transaction> {
    const registry = await this.#registry(
      this.#clients.get(rpcUrl),
      parentName,
    );
    if (registry === null) {
      throw new Error("The parent name has no registry.");
    }
    return { hash: await sendFromWallet(registry, data) };
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
}

/** A name in the DNS wire format ENSv2 contracts take, as hex. */
export function dnsEncode(name: string): Hex {
  return toHex(packetToBytes(name));
}

/** The later of `block` and the ENSv2 start block. */
function maxBlock(block: bigint): bigint {
  return block > ENSV2_START_BLOCK ? block : ENSV2_START_BLOCK;
}
