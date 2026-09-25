import type { Address } from "viem";

/**
 * The ENSv2 UniversalResolver on Sepolia, from the addresses list in
 * ensdomains/contracts-v2. It answers `findOwner` and `findExactRegistry`
 * for any DNS-encoded name.
 */
export const UNIVERSAL_RESOLVER: Address =
  "0x85edf8b6b7d4211e2b07aa687506b746357b92cf";

/** The block the ENSv2 registrar was deployed in; no registry is older. */
export const ENSV2_START_BLOCK = 11_163_403n;

/** The widest block range the public Sepolia endpoint answers logs for. */
export const LOG_BLOCK_RANGE = 50_000n;

/** How long a granted member name lasts before it must be granted again. */
export const MEMBER_DURATION_SECONDS = 365n * 24n * 60n * 60n;
