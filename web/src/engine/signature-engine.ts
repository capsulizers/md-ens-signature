/** What checking a Markdown file's signature concluded. */
export type Verdict =
  | UnsignedVerdict
  | TamperedVerdict
  | UnauthorizedVerdict
  | VerifiedVerdict
  | UnreachableVerdict;

/** The file carries no signature. */
export interface UnsignedVerdict {
  kind: "unsigned";
}

/** The name's owner did not sign this body: it was edited or another key signed. */
export interface TamperedVerdict {
  kind: "tampered";
  signer: string;
}

/** The signature is valid, but ENSv2 says the signer has no permission now. */
export interface UnauthorizedVerdict {
  kind: "unauthorized";
  signer: string;
  /** Why the name may not sign, such as it being revoked. */
  reason: string;
}

/** The owner of the signer name made this signature over this body. */
export interface VerifiedVerdict {
  kind: "verified";
  signer: string;
  address: string;
}

/** The Sepolia node could not be asked, so there is no verdict yet. */
export interface UnreachableVerdict {
  kind: "unreachable";
}

/**
 * Signs and verifies Markdown files, implemented by the library compiled
 * to WebAssembly.
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
