/** The tabs the page has, named as their panels are. */
export type Tab = "sign" | "read";

/** Where the page is: its tab and the published name being read. */
export interface Route {
  tab: Tab;
  /** The document name the Read tab shows, or empty before one is asked. */
  name: string;
}

/** The scheme of links between published documents. */
const MDTP_SCHEME = "mdtp://";

/** The hash prefix of the Read tab, followed by the document name. */
const READ_PREFIX = "#read/";

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
  if (hash.startsWith(READ_PREFIX)) {
    const name = decodeURIComponent(hash.slice(READ_PREFIX.length));
    return { tab: "read", name: documentName(name) };
  }
  if (hash === "#read") {
    return { tab: "read", name: "" };
  }
  return { tab: "sign", name: "" };
}

/** The location hash that shows `route`. */
export function routeHash(route: Route): string {
  if (route.tab === "sign") {
    return "#sign";
  }
  return route.name === "" ? "#read" : `${READ_PREFIX}${route.name}`;
}

/** Whether `tab` names one of the page's tabs. */
export function isTab(tab: string): tab is Tab {
  return tab === "sign" || tab === "read";
}
