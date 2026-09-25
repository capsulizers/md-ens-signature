/** Every piece of text the page shows, in one place. */
export const TEXT = {
  title: "Markdown ENS Signature",
  subtitle:
    "Sign a Markdown file with an ENS name and verify it against ENSv2 permissions on Sepolia.",
  rpcUrlLabel: "Sepolia RPC URL",
  parentNameLabel: "Parent ENS name",
  parentNameHint: "Members are subnames of this name.",
  fileLabel: "Markdown file",
  openFile: "Open file",
  filePlaceholder: "Drop a .md file here, open one, or type Markdown.",
  checking: "Checking",
  checkingDetail: "Verifying the signature against ENS.",
  verified: "Verified",
  verifiedDetail: (signer: string): string => `Signed by ${signer}`,
  tampered: "Tampered",
  tamperedDetail: (signer: string): string =>
    `The body or key no longer matches ${signer}`,
  unauthorized: "Unauthorized",
  unauthorizedDetail: (signer: string): string =>
    `Signer lost permission: ${signer}`,
  unsigned: "Unsigned",
  unsignedDetail: "This file carries no signature.",
};
