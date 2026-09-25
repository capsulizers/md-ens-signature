/** Whether a member name may sign for its parent right now. */
export type MemberStatus = "GRANTED" | "REVOKED";

/** One subname of the parent and its signing permission. */
export interface Member {
  name: string;
  status: MemberStatus;
}

/** A transaction the wallet has sent and the chain has yet to confirm. */
export interface Transaction {
  hash: string;
}

/**
 * Reads and changes which subnames may sign for a parent name. The real
 * implementation will send Sepolia transactions through viem and MetaMask;
 * until then the page runs on a mock.
 */
export interface PermissionsEngine {
  /** The parent's members and whether each may sign now. */
  members(parentName: string, rpcUrl: string): Promise<Member[]>;
  /** Sends the transaction that lets `member` sign for `parentName`. */
  grant(parentName: string, member: string): Promise<Transaction>;
  /** Sends the transaction that stops `member` signing for `parentName`. */
  revoke(parentName: string, member: string): Promise<Transaction>;
  /** Resolves once the transaction is confirmed on chain. */
  confirm(transaction: Transaction): Promise<void>;
}
