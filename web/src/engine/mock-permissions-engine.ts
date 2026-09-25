import type { MockRegistry } from "./mock-registry.ts";
import type {
  Member,
  MemberStatus,
  PermissionsEngine,
  Transaction,
} from "./permissions-engine.ts";

/** How long the mock wallet takes to send, and the mock chain to confirm. */
const MOCK_SEND_MS = 600;
const MOCK_CONFIRM_MS = 2500;

/**
 * A stand-in for the viem and MetaMask engine. Sending waits a moment and
 * returns a random hash; confirming waits again and then applies the change
 * to the mock registry.
 */
export class MockPermissionsEngine implements PermissionsEngine {
  #registry: MockRegistry;
  #pending = new Map<string, () => void>();

  constructor(registry: MockRegistry) {
    this.#registry = registry;
  }

  members(parentName: string, _rpcUrl: string): Promise<Member[]> {
    const members = this.#registry.members(parentName);
    return Promise.resolve(
      Array.from(
        members,
        (entry: [string, MemberStatus]): Member => ({
          name: entry[0],
          status: entry[1],
        }),
      ),
    );
  }

  grant(parentName: string, member: string): Promise<Transaction> {
    return this.#send(parentName, member, "GRANTED");
  }

  revoke(parentName: string, member: string): Promise<Transaction> {
    return this.#send(parentName, member, "REVOKED");
  }

  async confirm(transaction: Transaction): Promise<void> {
    await wait(MOCK_CONFIRM_MS);
    this.#pending.get(transaction.hash)?.();
    this.#pending.delete(transaction.hash);
  }

  async #send(
    parentName: string,
    member: string,
    status: MemberStatus,
  ): Promise<Transaction> {
    await wait(MOCK_SEND_MS);
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const hash = `0x${
      Array.from(
        bytes,
        (byte: number): string => byte.toString(16).padStart(2, "0"),
      ).join("")
    }`;
    this.#pending.set(hash, (): void => {
      this.#registry.set(parentName, member, status);
    });
    return { hash };
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve: () => void): void => {
    setTimeout(resolve, milliseconds);
  });
}
