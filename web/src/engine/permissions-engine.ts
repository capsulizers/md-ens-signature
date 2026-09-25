import type { Address } from "viem";

/** Whether a member name may sign for its parent right now. */
export type MemberStatus = "GRANTED" | "REVOKED";

/** One subname the parent has ever registered, as the chain sees it now. */
export interface Member {
  /** The full name, such as `carol.team.eth`. */
  name: string;
  /** The label under the parent, such as `carol`. */
  label: string;
  /** Who owns the name now, or null once it is revoked or expired. */
  owner: Address | null;
  status: MemberStatus;
}

/** Reads which subnames may sign for a parent name, from ENSv2 on Sepolia. */
export interface PermissionsEngine {
  /** Every subname the parent's registry has registered, oldest first. */
  members(parentName: string, rpcUrl: string): Promise<Member[]>;
}
