import type { MemberStatus } from "./permissions-engine.ts";

/** Members the demo starts with, keyed by parent name. */
const INITIAL_MEMBERS: [string, [string, MemberStatus][]][] = [
  ["alice.eth", [["bob.alice.eth", "GRANTED"], [
    "claude.alice.eth",
    "REVOKED",
  ]]],
];

/** The addresses the demo names resolve to, as in the Sepolia test keys. */
const INITIAL_ADDRESSES: [string, string][] = [
  ["bob.alice.eth", "0x26FaCbA3f9A98b20e40f2B41c1e1236dAA75ceE5"],
  ["claude.alice.eth", "0x756244CcE2fA5a5c33Ce1631E856dCd02BD6CEf9"],
];

/** The in-memory stand-in for ENS that the engines read until it lands. */
export class MockRegistry {
  #addresses = new Map<string, string>(INITIAL_ADDRESSES);

  #parents = new Map<string, Map<string, MemberStatus>>(
    INITIAL_MEMBERS.map((
      entry: [string, [string, MemberStatus][]],
    ): [string, Map<string, MemberStatus>] => [entry[0], new Map(entry[1])]),
  );

  /** The address a name resolves to, or null when it has none. */
  address(name: string): string | null {
    return this.#addresses.get(name) ?? null;
  }

  /** Points a name at an address, as its owner setting the record would. */
  setAddress(name: string, address: string): void {
    this.#addresses.set(name, address);
  }

  /** Every member of a parent with its status, in insertion order. */
  members(parentName: string): Map<string, MemberStatus> {
    return this.#parents.get(parentName) ?? new Map();
  }

  /** Records a member's new status under its parent. */
  set(parentName: string, member: string, status: MemberStatus): void {
    const members = this.#parents.get(parentName) ?? new Map();
    members.set(member, status);
    this.#parents.set(parentName, members);
  }
}
