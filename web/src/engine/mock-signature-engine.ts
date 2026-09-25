import type { SignatureEngine, Verdict } from "./signature-engine.ts";

const FENCE = "---";

/** Member names the mock treats as granted by their parent name. */
const MOCK_GRANTED_MEMBERS = new Set(["bob.alice.eth"]);

/** The address the mock reports for any verified signer. */
const MOCK_ADDRESS = "0x26FaCbA3f9A98b20e40f2B41c1e1236dAA75ceE5";

/** A file split at its frontmatter. */
interface SplitFile {
  frontmatter: string[] | null;
  body: string;
}

/**
 * A stand-in for the WebAssembly engine. Its "signature" is the SHA-256 of
 * the message written twice plus a recovery byte, so editing the body still
 * reads as tampering. Any signature attached during this session, such as
 * one made in a wallet, is also accepted for the message it was made over.
 */
export class MockSignatureEngine implements SignatureEngine {
  #attached = new Map<string, string>();

  async verify(
    markdown: string,
    _rpcUrl: string,
    parentName: string,
  ): Promise<Verdict> {
    const file = splitFile(markdown);
    const signer = readKey(file.frontmatter, "signer");
    const signature = readKey(file.frontmatter, "signature");
    if (signer === null || signature === null) {
      return { kind: "unsigned" };
    }
    const message = await this.message(markdown, signer);
    const expected = new Set([
      await mockSignature(message),
      this.#attached.get(message),
    ]);
    if (!expected.has(signature.toLowerCase())) {
      return { kind: "tampered", signer };
    }
    const isMember = signer.endsWith(`.${parentName}`) &&
      MOCK_GRANTED_MEMBERS.has(signer);
    return isMember
      ? { kind: "verified", signer, address: MOCK_ADDRESS }
      : { kind: "unauthorized", signer };
  }

  async message(markdown: string, signer: string): Promise<string> {
    const body = splitFile(markdown).body.replaceAll("\r\n", "\n").trimEnd();
    const digest = await sha256Hex(body);
    return [
      "Markdown signature",
      `Signer: ${signer.toLowerCase()}`,
      `Body SHA-256: 0x${digest}`,
    ].join("\n");
  }

  async attach(
    markdown: string,
    signer: string,
    signature: string,
  ): Promise<string> {
    const file = splitFile(markdown);
    const kept = (file.frontmatter ?? []).filter((line: string): boolean =>
      readLine(line, "signer") === null && readLine(line, "signature") === null
    );
    const lines = [`signer: ${signer}`, `signature: ${signature}`, ...kept];
    const message = await this.message(markdown, signer);
    this.#attached.set(message, signature.toLowerCase());
    return `${FENCE}\n${lines.join("\n")}\n${FENCE}\n${file.body}`;
  }
}

/** The mock signature of a message, as lowercase hex. */
async function mockSignature(message: string): Promise<string> {
  const digest = await sha256Hex(message);
  return `0x${digest}${digest}1b`;
}

function splitFile(markdown: string): SplitFile {
  const lines = markdown.split("\n");
  if (lines[0]?.replace(/\r$/, "") !== FENCE) {
    return { frontmatter: null, body: markdown };
  }
  const end = lines.findIndex((line: string, index: number): boolean =>
    index > 0 && line.replace(/\r$/, "") === FENCE
  );
  if (end < 0) {
    return { frontmatter: null, body: markdown };
  }
  return {
    frontmatter: lines.slice(1, end).map((line: string): string =>
      line.replace(/\r$/, "")
    ),
    body: lines.slice(end + 1).join("\n"),
  };
}

function readKey(frontmatter: string[] | null, key: string): string | null {
  for (const line of frontmatter ?? []) {
    const value = readLine(line, key);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

function readLine(line: string, key: string): string | null {
  if (!line.startsWith(`${key}:`)) {
    return null;
  }
  const value = line.slice(key.length + 1).trim();
  const quoted = /^(['"])(.*)\1$/.exec(value);
  return quoted?.[2] ?? value;
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(
    new Uint8Array(digest),
    (byte: number): string => byte.toString(16).padStart(2, "0"),
  ).join("");
}
