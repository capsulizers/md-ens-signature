import type { Address } from "viem";

import type { Transaction } from "./permissions-engine.ts";

/** What reading a published document concluded about it. */
export type PublishedVerdict =
  | "NOT_FOUND"
  | "TAMPERED"
  | "UNAUTHORIZED"
  | "VERIFIED";

/** A document read back from Sepolia through its name's `mdtp` record. */
export interface Publication {
  /** The lowercase document name, such as `skills.mdsig91205.eth`. */
  name: string;
  verdict: PublishedVerdict;
  /** The publishing transaction, or null when the name records none. */
  txHash: string | null;
  /** The ENS name the calldata says published it, or empty. */
  publisher: string;
  /** The published Markdown, or empty. */
  markdown: string;
  /** When the transaction's block was made, in Unix seconds (UTC). */
  timestamp: number;
}

/** Whether an account may point a document name's `mdtp` record. */
export type RecordAccess = "WRITABLE" | "NO_RESOLVER" | "DENIED";

/**
 * Publishes Markdown files to Ethereum under an ENS name and reads them
 * back. Publishing is two transactions from the browser wallet: the file as
 * calldata of a transaction to itself, then the document name's `mdtp` text
 * record pointed at it.
 */
export interface PublishEngine {
  /**
   * Reads and judges the document published under `name`, or null when the
   * Sepolia node could not be asked.
   */
  read(name: string, rpcUrl: string): Promise<Publication | null>;
  /**
   * Whether `publisher` may publish under `name`: the name itself, one of
   * its ancestors below `.eth`, or a subname of its parent.
   */
  mayPublish(publisher: string, name: string): Promise<boolean>;
  /** Whether `account` may set the `mdtp` record of `name`, by simulation. */
  recordAccess(
    name: string,
    account: Address,
    rpcUrl: string,
  ): Promise<RecordAccess>;
  /** Sends `markdown` as `publisher` in a transaction to the wallet itself. */
  publish(publisher: string, markdown: string): Promise<Transaction>;
  /** Points the `mdtp` record of `name` at the publishing transaction. */
  setRecord(
    name: string,
    published: Transaction,
    rpcUrl: string,
  ): Promise<Transaction>;
  /** Resolves once the transaction succeeds on chain; throws if it fails. */
  confirm(transaction: Transaction, rpcUrl: string): Promise<void>;
}
