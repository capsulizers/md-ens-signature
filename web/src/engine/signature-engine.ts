/** What checking a Markdown file's signature concluded. */
export type Verdict =
  | UnsignedVerdict
  | TamperedVerdict
  | UnauthorizedVerdict
  | VerifiedVerdict;

/** The file carries no signature. */
export interface UnsignedVerdict {
  kind: "unsigned";
}

/** The signature does not match the body and the signer's address. */
export interface TamperedVerdict {
  kind: "tampered";
  signer: string;
}

/** The signature is valid, but ENSv2 says the signer has no permission now. */
export interface UnauthorizedVerdict {
  kind: "unauthorized";
  signer: string;
}

/** The signer's current address made this signature over this body. */
export interface VerifiedVerdict {
  kind: "verified";
  signer: string;
  address: string;
}

/**
 * Signs and verifies Markdown files. The library compiled to WebAssembly
 * will implement this; until then the page runs on a mock.
 */
export interface SignatureEngine {
  /** Checks a file's signature against ENS through the given RPC endpoint. */
  verify(
    markdown: string,
    rpcUrl: string,
    parentName: string,
  ): Promise<Verdict>;
  /** The exact text a wallet signs with personal_sign for this signer. */
  message(markdown: string, signer: string): Promise<string>;
  /** The file with its signer and signature written into the frontmatter. */
  attach(
    markdown: string,
    signer: string,
    signature: string,
  ): Promise<string>;
}
