import {
  type Address,
  encodeFunctionData,
  type Hex,
  maxUint256,
  namehash,
  parseAbi,
  parseEventLogs,
  toHex,
  type TransactionReceipt,
  zeroHash,
} from "viem";

import {
  ALL_ROLES,
  COMMITMENT_AGE_SECONDS,
  MOCK_USDC,
  REGISTRAR,
  RESOLVER_IMPL,
  TEAM_DURATION_SECONDS,
  TEAM_USDC_AMOUNT,
  USER_REGISTRY_IMPL,
  VERIFIABLE_FACTORY,
} from "#constants";

import type { SepoliaClients } from "./sepolia-clients.ts";
import type { TeamEngine, TeamStep, TeamStepState } from "./team-engine.ts";
import { sendFromWallet, walletAccount } from "./wallet.ts";

const REGISTRAR_ABI = parseAbi([
  "function isAvailable(string label) view returns (bool)",
  "function makeCommitment(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, bytes32 referrer) pure returns (bytes32)",
  "function commit(bytes32 commitment)",
  "function register(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, address paymentToken, bytes32 referrer) returns (uint256)",
]);

const FACTORY_ABI = parseAbi([
  "function deployProxy(address implementation, uint256 salt, bytes data) returns (address)",
  "event ProxyDeployed(address indexed sender, address indexed proxyAddress, uint256 salt, address implementation)",
]);

const INITIALIZE_ABI = parseAbi([
  "function initialize(address root, uint256 roleBitmap)",
  "function initialize(address admin, uint256 roleBitmap, bytes[] setters)",
]);

const USDC_ABI = parseAbi([
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

const RESOLVER_ABI = parseAbi([
  "function setAddr(bytes32 node, address addr)",
]);

/** A step's reporter, bound to the step it reports. */
type Report = (state: TeamStepState) => void;

/** One step's state before it starts. */
const WAITING: TeamStepState = {
  transaction: null,
  isDone: false,
  secondsLeft: null,
};

/**
 * Registers a team name the way the ENSv2 registrar expects, sending every
 * transaction from the connected wallet. The name owns its own UserRegistry,
 * so the owner can later register members under it.
 */
export class ChainTeamEngine implements TeamEngine {
  #clients: SepoliaClients;

  constructor(clients: SepoliaClients) {
    this.#clients = clients;
  }

  async isAvailable(label: string, rpcUrl: string): Promise<boolean> {
    return await this.#clients.get(rpcUrl).readContract({
      address: REGISTRAR,
      abi: REGISTRAR_ABI,
      functionName: "isAvailable",
      args: [label],
    });
  }

  async create(
    label: string,
    rpcUrl: string,
    onStep: (step: TeamStep, state: TeamStepState) => void,
  ): Promise<void> {
    const report = (step: TeamStep): Report => (state: TeamStepState): void =>
      onStep(step, state);
    const owner = await walletAccount();
    const registry = await this.#deploy(
      USER_REGISTRY_IMPL,
      encodeFunctionData({
        abi: INITIALIZE_ABI,
        functionName: "initialize",
        args: [owner, ALL_ROLES],
      }),
      rpcUrl,
      report("DEPLOY_REGISTRY"),
    );
    const resolver = await this.#deploy(
      RESOLVER_IMPL,
      encodeFunctionData({
        abi: INITIALIZE_ABI,
        functionName: "initialize",
        args: [owner, ALL_ROLES, []],
      }),
      rpcUrl,
      report("DEPLOY_RESOLVER"),
    );
    await this.#pay(owner, rpcUrl, report);
    const secret = randomHash();
    const commitment = await this.#clients.get(rpcUrl).readContract({
      address: REGISTRAR,
      abi: REGISTRAR_ABI,
      functionName: "makeCommitment",
      args: [
        label,
        owner,
        secret,
        registry,
        resolver,
        TEAM_DURATION_SECONDS,
        zeroHash,
      ],
    });
    const committed = await this.#send(
      REGISTRAR,
      encodeFunctionData({
        abi: REGISTRAR_ABI,
        functionName: "commit",
        args: [commitment],
      }),
      rpcUrl,
      report("COMMIT"),
    );
    await this.#waitForCommitment(committed, rpcUrl, report("WAIT"));
    await this.#send(
      REGISTRAR,
      encodeFunctionData({
        abi: REGISTRAR_ABI,
        functionName: "register",
        args: [
          label,
          owner,
          secret,
          registry,
          resolver,
          TEAM_DURATION_SECONDS,
          MOCK_USDC,
          zeroHash,
        ],
      }),
      rpcUrl,
      report("REGISTER"),
    );
    await this.#send(
      resolver,
      encodeFunctionData({
        abi: RESOLVER_ABI,
        functionName: "setAddr",
        args: [namehash(`${label}.eth`), owner],
      }),
      rpcUrl,
      report("SET_ADDRESS"),
    );
  }

  /** Mints test USDC to the owner and lets the registrar spend it. */
  async #pay(
    owner: Address,
    rpcUrl: string,
    report: (step: TeamStep) => Report,
  ): Promise<void> {
    await this.#send(
      MOCK_USDC,
      encodeFunctionData({
        abi: USDC_ABI,
        functionName: "mint",
        args: [owner, TEAM_USDC_AMOUNT],
      }),
      rpcUrl,
      report("MINT"),
    );
    await this.#send(
      MOCK_USDC,
      encodeFunctionData({
        abi: USDC_ABI,
        functionName: "approve",
        args: [REGISTRAR, maxUint256],
      }),
      rpcUrl,
      report("APPROVE"),
    );
  }

  /** Deploys a verifiable proxy of `implementation` and returns its address. */
  async #deploy(
    implementation: Address,
    initData: Hex,
    rpcUrl: string,
    report: Report,
  ): Promise<Address> {
    const receipt = await this.#send(
      VERIFIABLE_FACTORY,
      encodeFunctionData({
        abi: FACTORY_ABI,
        functionName: "deployProxy",
        args: [implementation, BigInt(randomHash()), initData],
      }),
      rpcUrl,
      report,
    );
    const [deployed] = parseEventLogs({
      abi: FACTORY_ABI,
      eventName: "ProxyDeployed",
      logs: receipt.logs,
    });
    if (deployed === undefined) {
      throw new Error("The factory deployed no proxy.");
    }
    return deployed.args.proxyAddress;
  }

  /** Sends one transaction and waits for it, reporting both moments. */
  async #send(
    to: Address,
    data: Hex,
    rpcUrl: string,
    report: Report,
  ): Promise<TransactionReceipt> {
    report({ ...WAITING });
    const transaction = { hash: await sendFromWallet(to, data) };
    report({ ...WAITING, transaction });
    const receipt = await this.#clients.confirm(transaction.hash, rpcUrl);
    report({ ...WAITING, transaction, isDone: true });
    return receipt;
  }

  /**
   * Counts down until the commitment is old enough, then keeps waiting until
   * the chain's own clock agrees, since that is what the registrar checks.
   */
  async #waitForCommitment(
    committed: TransactionReceipt,
    rpcUrl: string,
    report: Report,
  ): Promise<void> {
    const client = this.#clients.get(rpcUrl);
    const block = await client.getBlock({ blockHash: committed.blockHash });
    const readyAt = block.timestamp + BigInt(COMMITMENT_AGE_SECONDS);
    for (let left = COMMITMENT_AGE_SECONDS; left > 0; left -= 1) {
      report({ ...WAITING, secondsLeft: left });
      await wait(1000);
    }
    report({ ...WAITING, secondsLeft: 0 });
    while ((await client.getBlock()).timestamp <= readyAt) {
      await wait(1000);
    }
    report({ ...WAITING, isDone: true });
  }
}

/** A random 32-byte value, for salts and commitment secrets. */
function randomHash(): Hex {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve: () => void): void => {
    setTimeout(resolve, milliseconds);
  });
}
