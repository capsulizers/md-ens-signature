/** What reading a published document concluded about it. */
export type PublishedVerdict =
  | "notFound"
  | "tampered"
  | "unauthorized"
  | "verified";

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

/** Reads documents published to Ethereum under an ENS name. */
export interface PublishEngine {
  /**
   * Reads and judges the document published under `name`, or null when the
   * Sepolia node could not be asked.
   */
  read(name: string, rpcUrl: string): Promise<Publication | null>;
}
