import type { Address } from "viem";

/*
 * The ENSv2 contracts on Sepolia come from the addresses list in
 * ensdomains/contracts-v2.
 */

/**
 * The ENSv2 UniversalResolver. It answers `findOwner` and `findExactRegistry`
 * for any DNS-encoded name.
 */
export const UNIVERSAL_RESOLVER: Address =
  "0x85edf8b6b7d4211e2b07aa687506b746357b92cf";

/** The block the ENSv2 registrar was deployed in; no registry is older. */
export const ENSV2_START_BLOCK = 11_163_403n;

/** The widest block range the public Sepolia endpoint answers logs for. */
export const LOG_BLOCK_RANGE = 50_000n;

/** The root role that lets an account register subnames in a registry. */
export const ROLE_REGISTRAR = 1n;

/** The root role that lets an account unregister any subname in a registry. */
export const ROLE_UNREGISTER = 1n << 12n;

/** How long a granted member name lasts before it must be granted again. */
export const MEMBER_DURATION_SECONDS = 365n * 24n * 60n * 60n;

/** The ENSv2 registrar that sells `.eth` names with commit and reveal. */
export const REGISTRAR: Address = "0xa4449a0dd2b83007553d9b1d28b583a46a805a30";

/** The testnet stablecoin the registrar is paid in; anyone may mint it. */
export const MOCK_USDC: Address = "0xd3322b29a7bdee707d1684676f149bf41aa3422f";

/** Deploys proxies whose code the chain can later verify. */
export const VERIFIABLE_FACTORY: Address =
  "0x118bc31a50d559f7015a8da26d54b3b030cdb70f";

/** The UserRegistry implementation a team's registry proxies. */
export const USER_REGISTRY_IMPL: Address =
  "0x840fa461059862ea466a711e8c98c8de732061c0";

/** The PermissionedResolver implementation a team's resolver proxies. */
export const RESOLVER_IMPL: Address =
  "0x7e4b2d59938930168024201752ee5503df402303";

/** Every role a registry or resolver knows: bit 0 of each nybble set. */
export const ALL_ROLES = BigInt(`0x${"1".repeat(64)}`);

/** How long a new team name is registered for. */
export const TEAM_DURATION_SECONDS = 365n * 24n * 60n * 60n;

/** How much test USDC to mint, in 6-decimal units, to pay for the name. */
export const TEAM_USDC_AMOUNT = 1_000n * 1_000_000n;

/** How long a commitment must age before the name can be registered. */
export const COMMITMENT_AGE_SECONDS = 60;
