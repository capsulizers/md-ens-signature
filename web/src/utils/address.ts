/** The horizontal ellipsis, spelled by code point to keep the source ASCII. */
const ELLIPSIS = String.fromCodePoint(0x2026);

/** An address cut to its first and last four hex digits, as wallets show it. */
export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}${ELLIPSIS}${address.slice(-4)}`;
}
