/** The tabs the page has, named as their panels are. */
export type Tab = "SIGN" | "PUBLISH" | "READ";

/** Where the page is: its tab and the published name being read. */
export interface Route {
  tab: Tab;
  /** The document name the Read tab shows, or empty before one is asked. */
  name: string;
}

/** The scheme of links between published documents. */
const MDTP_SCHEME = "mdtp://";

/** The hash of the Read tab, followed by a slash and the document name. */
const READ_HASH = "#read";

/**
 * The document name in `mdtp://name.eth`, `name.eth`, or a hash route,
 * lowercase and without the scheme or a trailing slash.
 */
export function documentName(input: string): string {
  let name = input.trim().toLowerCase();
  if (name.startsWith(MDTP_SCHEME)) {
    name = name.slice(MDTP_SCHEME.length);
  }
  return name.replace(/\/+$/, "");
}

/** Whether `href` links to a published document. */
export function isMdtpLink(href: string): boolean {
  return href.trim().toLowerCase().startsWith(MDTP_SCHEME);
}

/** The shareable link to the document published under `name`. */
export function mdtpLink(name: string): string {
  return `${MDTP_SCHEME}${name}`;
}

/** Reads the route from a location hash such as `#read/name.eth`. */
export function parseRoute(hash: string): Route {
  if (hash.startsWith(`${READ_HASH}/`)) {
    const name = decodeURIComponent(hash.slice(READ_HASH.length + 1));
    return { tab: "READ", name: documentName(name) };
  }
  const tab = hash.slice(1).toUpperCase();
  return { tab: isTab(tab) ? tab : "SIGN", name: "" };
}

/** The location hash that shows `route`. */
export function routeHash(route: Route): string {
  const hash = `#${route.tab.toLowerCase()}`;
  return route.tab === "READ" && route.name !== ""
    ? `${hash}/${route.name}`
    : hash;
}

/** The location hash that reads the document published under `name`. */
export function readHash(name: string): string {
  return routeHash({ tab: "READ", name: documentName(name) });
}

/** Whether `href` is a hash that reads a published document. */
export function isReadHash(href: string): boolean {
  return href.startsWith(`${READ_HASH}/`);
}

/** Whether `tab` names one of the page's tabs. */
export function isTab(tab: string): tab is Tab {
  return tab === "SIGN" || tab === "PUBLISH" || tab === "READ";
}
