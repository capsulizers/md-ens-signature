import type { MemberStatus } from "./permissions-engine.ts";

/** Members the demo starts with, keyed by parent name. */
const INITIAL_MEMBERS: [string, [string, MemberStatus][]][] = [
  ["alice.eth", [["bob.alice.eth", "GRANTED"], [
    "claude.alice.eth",
    "REVOKED",
  ]]],
];

/** The in-memory stand-in for ENSv2 that both mock engines read. */
export class MockRegistry {
  #parents = new Map<string, Map<string, MemberStatus>>(
    INITIAL_MEMBERS.map((
      entry: [string, [string, MemberStatus][]],
    ): [string, Map<string, MemberStatus>] => [entry[0], new Map(entry[1])]),
  );

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
