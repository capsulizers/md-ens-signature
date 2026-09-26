import type { Address, Hash } from "viem";

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

/** A transaction the wallet has sent and the chain has yet to confirm. */
export interface Transaction {
  hash: Hash;
}

/**
 * Reads and changes which subnames may sign for a parent name, through
 * ENSv2 on Sepolia. Changes are sent by the browser wallet's account, which
 * must own the parent or hold the matching root role on its registry.
 */
export interface PermissionsEngine {
  /** Every subname the parent's registry has registered, oldest first. */
  members(parentName: string, rpcUrl: string): Promise<Member[]>;
  /** Who owns `name` now, or null when nobody does. */
  owner(name: string, rpcUrl: string): Promise<Address | null>;
  /** Whether `account` holds every role in `roleBitmap` on the parent's registry. */
  hasRootRoles(
    parentName: string,
    roleBitmap: bigint,
    account: Address,
    rpcUrl: string,
  ): Promise<boolean>;
  /** Registers `label` under the parent, owned by `member`, for a year. */
  grant(
    parentName: string,
    label: string,
    member: Address,
    rpcUrl: string,
  ): Promise<Transaction>;
  /** Unregisters `label` from the parent, so it can no longer sign. */
  revoke(
    parentName: string,
    label: string,
    rpcUrl: string,
  ): Promise<Transaction>;
  /** Resolves once the transaction succeeds on chain; throws if it fails. */
  confirm(transaction: Transaction, rpcUrl: string): Promise<void>;
}
