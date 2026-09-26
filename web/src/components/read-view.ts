import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/callout/callout.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
import "@awesome.me/webawesome/dist/components/input/input.js";
import "@awesome.me/webawesome/dist/components/spinner/spinner.js";
import { consume } from "@lit/context";
import { css, html, LitElement, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { ETHERSCAN_TX_URL, EXAMPLE_DOCUMENT_NAME, TEXT } from "#constants";
import {
  EMPTY_ENGINES,
  EMPTY_SETTINGS_CONTEXT,
  type Engines,
  enginesContext,
  type SettingsContext,
  settingsContext,
} from "#context";
import type { Publication, Verdict, Version } from "#engine";
import {
  documentName,
  mdtpLink,
  readHash,
  syncAfterSet,
  utcTime,
} from "#utils";

import "./markdown-view.ts";
import "./verdict-badge.ts";
import "./version-list.ts";

declare global {
  interface HTMLElementTagNameMap {
    "md-read-view": ReadViewElement;
  }
}

/** Where reading the current name stands. */
type ReadState = IdleState | ReadingState | ReadDoneState | UnreachableState;

/** No name has been asked for yet. */
interface IdleState {
  kind: "IDLE";
}

/** The name is being read from Sepolia. */
interface ReadingState {
  kind: "READING";
}

/** The name was read, whatever the verdict. */
interface ReadDoneState {
  kind: "READ";
  publication: Publication;
}

/** The Sepolia node did not answer. */
interface UnreachableState {
  kind: "UNREACHABLE";
}

/** Where reading the document's versions stands. */
type VersionsState =
  | VersionsLoadingState
  | VersionsLoadedState
  | VersionsFailedState;

/** The versions are being read from Sepolia. */
interface VersionsLoadingState {
  kind: "LOADING";
}

/** The versions were read, newest first. */
interface VersionsLoadedState {
  kind: "LOADED";
  versions: Version[];
}

/** The Sepolia node did not answer for the versions. */
interface VersionsFailedState {
  kind: "FAILED";
}

/** An older version shown in place of the current one, and its reading. */
interface OlderVersion {
  version: Version;
  state: ReadState;
}

/** The signature verdict the badge shows when the node did not answer. */
const UNREACHABLE: Verdict = { kind: "unreachable" };

/** Reads a document published under an ENS name, with no wallet needed. */
@customElement("md-read-view")
export class ReadViewElement extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--wa-space-l);
    }

    form {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: var(--wa-space-s);
    }

    wa-input {
      flex: 1 1 20rem;
      min-width: 0;
    }

    .hint,
    .status {
      color: var(--wa-color-text-quiet);
      font-size: var(--wa-font-size-s);
    }

    .older {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--wa-space-s);
    }

    .open {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--wa-space-s);
    }

    .status {
      display: flex;
      align-items: center;
      gap: var(--wa-space-xs);
    }

    a {
      color: var(--wa-color-text-link);
    }

    dl {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr);
      gap: var(--wa-space-2xs) var(--wa-space-l);
      margin: 0;
    }

    dt {
      color: var(--wa-color-text-quiet);
    }

    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }

    .code {
      font-family: var(--wa-font-family-code);
    }

    md-markdown-view {
      padding: var(--wa-space-xl);
      border: var(--wa-border-width-s) solid var(--wa-color-surface-border);
      border-radius: var(--wa-border-radius-l);
      background: var(--wa-color-surface-default);
    }
  `;

  /** The document name to read, or empty to wait for one. */
  @property({ attribute: false })
  @syncAfterSet((host: ReadViewElement): void => host.#read())
  accessor name: string = "";

  @consume({ context: enginesContext, subscribe: true })
  accessor #engines: Engines = EMPTY_ENGINES;

  @consume({ context: settingsContext, subscribe: true })
  @syncAfterSet((host: ReadViewElement): void => host.#read())
  accessor #settings: SettingsContext = EMPTY_SETTINGS_CONTEXT;

  @state()
  accessor #state: ReadState = { kind: "IDLE" };

  @state()
  accessor #versions: VersionsState = { kind: "LOADING" };

  /** The older version shown instead of the current one, or null. */
  @state()
  accessor #older: OlderVersion | null = null;

  /** Bumped per read, so an answer for an older name is dropped. */
  #request = 0;

  override render(): TemplateResult {
    const value = this.name === "" ? "" : mdtpLink(this.name);
    const exampleHref = readHash(EXAMPLE_DOCUMENT_NAME);
    const exampleLink = mdtpLink(EXAMPLE_DOCUMENT_NAME);
    const result = this.#renderState();
    return html`
      <form @submit=${this.#onSubmit}>
        <wa-input
          name="name"
          label=${TEXT.readLabel}
          placeholder=${TEXT.readPlaceholder}
          .value=${value}
        ></wa-input>
        <wa-button type="submit" variant="brand">
          <wa-icon slot="start" name="search"></wa-icon>
          ${TEXT.read}
        </wa-button>
      </form>
      <div class="hint">
        ${TEXT.readHint} ${TEXT.readExample}
        <a class="code" href=${exampleHref}>${exampleLink}</a>
      </div>
      ${result}
    `;
  }

  #renderState(): TemplateResult {
    const state = this.#state;
    switch (state.kind) {
      case "IDLE":
        return html``;
      case "READING": {
        const text = TEXT.reading(this.name);
        return html`
          <div class="status" role="status">
            <wa-spinner></wa-spinner>
            ${text}
          </div>
        `;
      }
      case "UNREACHABLE":
        return html`
          <md-verdict-badge .verdict=${UNREACHABLE}></md-verdict-badge>
        `;
      case "READ":
        return this.#renderPublication(state.publication);
    }
  }

  #renderPublication(current: Publication): TemplateResult {
    const older = this.#older;
    const open = this.#renderOpenInMemona(current);
    const versions = this.#renderVersions();
    if (older === null) {
      const extras = html`
        ${versions} ${open}
      `;
      return this.#renderDocument(current, extras);
    }
    const time = utcTime(older.version.timestamp);
    const olderText = TEXT.olderVersion(time);
    const note = html`
      <wa-callout variant="warning" appearance="outlined">
        <wa-icon slot="icon" name="clock-history"></wa-icon>
        <div class="older">
          <span>${olderText}</span>
          <wa-button size="small" @click=${this.#showCurrent}>
            <wa-icon slot="start" name="arrow-left"></wa-icon>
            ${TEXT.olderVersionBack}
          </wa-button>
        </div>
      </wa-callout>
    `;
    const state = older.state;
    switch (state.kind) {
      case "IDLE":
      case "READING":
        return html`
          ${note}
          <div class="status" role="status">
            <wa-spinner></wa-spinner>
            ${TEXT.readingVersion}
          </div>
          ${versions}
        `;
      case "UNREACHABLE":
        return html`
          ${note}
          <md-verdict-badge .verdict=${UNREACHABLE}></md-verdict-badge>
          ${versions}
        `;
      case "READ": {
        const document = this.#renderDocument(state.publication, versions);
        return html`
          ${note} ${document}
        `;
      }
    }
  }

  /** The verdict, facts, `extras` such as the versions, and the body. */
  #renderDocument(
    publication: Publication,
    extras: TemplateResult,
  ): TemplateResult {
    const body = publication.markdown === "" ? html`` : html`
      <md-markdown-view .markdown=${publication.markdown}></md-markdown-view>
    `;
    const facts = this.#renderFacts(publication);
    return html`
      <md-verdict-badge .publication=${publication}></md-verdict-badge>
      ${facts} ${extras} ${body}
    `;
  }

  /** The document's versions, newest first, once read. */
  #renderVersions(): TemplateResult {
    const state = this.#versions;
    switch (state.kind) {
      case "LOADING":
        return html`
          <div class="status" role="status">
            <wa-spinner></wa-spinner>
            ${TEXT.versionsLoading}
          </div>
        `;
      case "FAILED":
        return html`
          <div class="status">${TEXT.versionsFailed}</div>
        `;
      case "LOADED": {
        if (state.versions.length === 0) {
          return html``;
        }
        const shown = this.#older?.version ?? state.versions[0] ?? null;
        return html`
          <md-version-list
            .versions=${state.versions}
            .shown=${shown}
            @version-select=${this.#onVersionSelect}
          ></md-version-list>
        `;
      }
    }
  }

  /** A link to the same document in the Memona app, through the OS. */
  #renderOpenInMemona(publication: Publication): TemplateResult {
    if (publication.verdict === "NOT_FOUND") {
      return html``;
    }
    const href = mdtpLink(publication.name);
    return html`
      <div class="open">
        <wa-button href=${href} size="small">
          <wa-icon slot="start" name="box-arrow-up-right"></wa-icon>
          ${TEXT.openInMemona}
        </wa-button>
        <span class="hint">${TEXT.openInMemonaHint}</span>
      </div>
    `;
  }

  /** The publisher, published time, and transaction, where known. */
  #renderFacts(publication: Publication): TemplateResult {
    const { publisher, timestamp, txHash } = publication;
    if (txHash === null) {
      return html``;
    }
    const url = `${ETHERSCAN_TX_URL}${txHash}`;
    const who = publisher === "" ? html`` : html`
      <dt>${TEXT.publisherLabel}</dt>
      <dd>${publisher}</dd>
    `;
    const time = utcTime(timestamp);
    const when = timestamp === 0 ? html`` : html`
      <dt>${TEXT.publishedAtLabel}</dt>
      <dd>${time}</dd>
    `;
    return html`
      <dl>
        ${who} ${when}
        <dt>${TEXT.transactionLabel}</dt>
        <dd>
          <a class="code" href=${url} target="_blank" rel="noopener noreferrer">
            ${txHash}
          </a>
        </dd>
      </dl>
    `;
  }

  /** Shows the chosen version, or the current one for the newest. */
  #onVersionSelect(event: CustomEvent<Version>): void {
    const version = event.detail;
    const state = this.#versions;
    const isNewest = state.kind === "LOADED" && state.versions[0] === version;
    if (isNewest || version.txHash === null) {
      this.#showCurrent();
      return;
    }
    this.#older = { version, state: { kind: "READING" } };
    void this.#fetchVersion(this.#request, version, version.txHash);
  }

  #showCurrent(): void {
    this.#older = null;
  }

  async #fetchVersion(
    request: number,
    version: Version,
    txHash: string,
  ): Promise<void> {
    const publication = await this.#engines.publish.readVersion(
      this.name,
      txHash,
      this.#settings.settings.rpcUrl,
    );
    if (request === this.#request && this.#older?.version === version) {
      const state: ReadState = publication === null
        ? { kind: "UNREACHABLE" }
        : { kind: "READ", publication };
      this.#older = { version, state };
    }
  }

  /** Moves the page to the name typed, which reads it through the route. */
  #onSubmit(event: SubmitEvent): void {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    const value = new FormData(form).get("name");
    const name = documentName(typeof value === "string" ? value : "");
    if (name === "") {
      return;
    }
    if (name === this.name) {
      this.#read();
      return;
    }
    globalThis.location.hash = readHash(name);
  }

  /** Reads the current name again, dropping any read still under way. */
  #read(): void {
    this.#request += 1;
    if (this.name === "") {
      this.#state = { kind: "IDLE" };
      return;
    }
    this.#state = { kind: "READING" };
    this.#versions = { kind: "LOADING" };
    this.#older = null;
    void this.#fetch(this.#request, this.name);
    void this.#fetchVersions(this.#request, this.name);
  }

  async #fetchVersions(request: number, name: string): Promise<void> {
    const versions = await this.#engines.publish.versions(
      name,
      this.#settings.settings.rpcUrl,
    );
    if (request === this.#request) {
      this.#versions = versions === null
        ? { kind: "FAILED" }
        : { kind: "LOADED", versions };
    }
  }

  async #fetch(request: number, name: string): Promise<void> {
    const publication = await this.#engines.publish.read(
      name,
      this.#settings.settings.rpcUrl,
    );
    if (request !== this.#request) {
      return;
    }
    this.#state = publication === null
      ? { kind: "UNREACHABLE" }
      : { kind: "READ", publication };
  }
}
