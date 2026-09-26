import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/copy-button/copy-button.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
import WaInput from "@awesome.me/webawesome/dist/components/input/input.js";
import "@awesome.me/webawesome/dist/components/spinner/spinner.js";
import { consume } from "@lit/context";
import { css, html, LitElement, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";

import { TEXT } from "#constants";
import {
  EMPTY_ENGINES,
  EMPTY_SETTINGS_CONTEXT,
  EMPTY_WALLET_CONTEXT,
  type Engines,
  enginesContext,
  type SettingsContext,
  settingsContext,
  type WalletContext,
  walletContext,
} from "#context";
import { type Transaction, WALLET_CHAIN } from "#engine";
import { documentName, mdtpLink, readHash, syncAfterSet } from "#utils";

import "./file-area.ts";
import "./transaction-note.ts";

declare global {
  interface HTMLElementTagNameMap {
    "md-publish-view": PublishViewElement;
  }
}

/** Whether the wallet may publish the names typed, and why not. */
type Readiness = ReadyState | CheckingState | BlockedState;

/** Nothing stands in the way of publishing. */
interface ReadyState {
  kind: "READY";
}

/** The chain is being asked whether the wallet may publish. */
interface CheckingState {
  kind: "CHECKING";
}

/** Publishing is not possible now. */
interface BlockedState {
  kind: "BLOCKED";
  /** Why, or null when the reason needs no words. */
  hint: string | null;
}

/** The readiness before any name is typed. */
const BLOCKED: BlockedState = { kind: "BLOCKED", hint: null };

/** One of the two transactions publishing sends. */
interface Step {
  transaction: Transaction | null;
  isPending: boolean;
  hasFailed: boolean;
}

const IDLE_STEP: Step = {
  transaction: null,
  isPending: false,
  hasFailed: false,
};

/**
 * Publishes a Markdown file to Sepolia under an ENS name with the browser
 * wallet, and hands back its shareable `mdtp://` link.
 */
@customElement("md-publish-view")
export class PublishViewElement extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--wa-space-l);
      max-width: 48rem;
    }

    h2 {
      margin: 0;
      font-size: var(--wa-font-size-l);
    }

    p {
      margin: var(--wa-space-2xs) 0 0;
      color: var(--wa-color-text-quiet);
    }

    .names {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--wa-space-m);
    }

    @media (max-width: 40rem) {
      .names {
        grid-template-columns: 1fr;
      }
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--wa-space-s);
    }

    .hint {
      display: flex;
      align-items: center;
      gap: var(--wa-space-xs);
      color: var(--wa-color-text-quiet);
      font-size: var(--wa-font-size-s);
    }

    .step {
      display: flex;
      flex-direction: column;
      gap: var(--wa-space-2xs);
    }

    .done {
      display: flex;
      flex-direction: column;
      gap: var(--wa-space-xs);
      padding: var(--wa-space-l);
      border: var(--wa-border-width-m) solid
        var(--wa-color-success-border-loud);
      border-radius: var(--wa-border-radius-l);
      background: var(--wa-color-success-fill-quiet);
      color: var(--wa-color-success-on-quiet);
    }

    .done strong {
      font-size: var(--wa-font-size-l);
    }

    .link {
      display: flex;
      align-items: center;
      gap: var(--wa-space-2xs);
      font-family: var(--wa-font-family-code);
    }

    a {
      color: var(--wa-color-text-link);
    }
  `;

  @consume({ context: enginesContext, subscribe: true })
  accessor #engines: Engines = EMPTY_ENGINES;

  @consume({ context: settingsContext, subscribe: true })
  @syncAfterSet((host: PublishViewElement): void => host.#check())
  accessor #settings: SettingsContext = EMPTY_SETTINGS_CONTEXT;

  @consume({ context: walletContext, subscribe: true })
  @syncAfterSet((host: PublishViewElement): void => host.#check())
  accessor #wallet: WalletContext = EMPTY_WALLET_CONTEXT;

  @state()
  accessor #markdown: string = "";

  @state()
  accessor #name: string = "";

  @state()
  accessor #publisher: string = "";

  @state()
  accessor #readiness: Readiness = BLOCKED;

  @state()
  accessor #fileStep: Step = IDLE_STEP;

  @state()
  accessor #recordStep: Step = IDLE_STEP;

  @state()
  accessor #published: string = "";

  /** Bumped per check, so an answer for older names is dropped. */
  #checkRequest = 0;

  override render(): TemplateResult {
    const isBusy = this.#fileStep.isPending || this.#recordStep.isPending;
    const isDisabled = this.#readiness.kind !== "READY" ||
      this.#markdown.trim() === "" || isBusy;
    const hint = isBusy ? html`` : this.#renderHint();
    const fileStep = this.#renderStep(TEXT.fileStep, this.#fileStep);
    const recordStep = this.#renderStep(TEXT.recordStep, this.#recordStep);
    const done = this.#renderDone();
    return html`
      <div>
        <h2>${TEXT.publishTitle}</h2>
        <p>${TEXT.publishSubtitle}</p>
      </div>
      <md-file-area
        .markdown=${this.#markdown}
        @markdown-change=${this.#onMarkdownChange}
      ></md-file-area>
      <div class="names">
        <wa-input
          label=${TEXT.documentNameLabel}
          placeholder=${TEXT.documentNamePlaceholder}
          .value=${this.#name}
          @input=${this.#onNameInput}
        ></wa-input>
        <wa-input
          label=${TEXT.publishAsLabel}
          placeholder=${TEXT.publisherPlaceholder}
          .value=${this.#publisher}
          @input=${this.#onPublisherInput}
        ></wa-input>
      </div>
      <div class="actions">
        <wa-button
          variant="brand"
          ?disabled=${isDisabled}
          ?loading=${isBusy}
          @click=${this.#publish}
        >
          <wa-icon slot="start" name="send"></wa-icon>
          ${TEXT.publish}
        </wa-button>
        ${hint}
      </div>
      ${fileStep} ${recordStep} ${done}
    `;
  }

  #renderHint(): TemplateResult {
    const readiness = this.#readiness;
    if (readiness.kind === "CHECKING") {
      return html`
        <div class="hint" role="status">
          <wa-spinner></wa-spinner>
          ${TEXT.publishChecking}
        </div>
      `;
    }
    if (readiness.kind === "BLOCKED" && readiness.hint !== null) {
      return html`
        <div class="hint">${readiness.hint}</div>
      `;
    }
    return html``;
  }

  #renderStep(label: string, step: Step): TemplateResult {
    if (step.transaction === null && !step.isPending && !step.hasFailed) {
      return html``;
    }
    return html`
      <div class="step">
        <span>${label}</span>
        <md-transaction-note
          .transaction=${step.transaction}
          .isPending=${step.isPending}
          .hasFailed=${step.hasFailed}
        ></md-transaction-note>
      </div>
    `;
  }

  #renderDone(): TemplateResult {
    if (this.#published === "") {
      return html``;
    }
    const link = mdtpLink(this.#published);
    const href = readHash(this.#published);
    return html`
      <div class="done" role="status">
        <strong>${TEXT.publishedTitle}</strong>
        <span>${TEXT.publishedShare}</span>
        <div class="link">
          <a href=${href}>${link}</a>
          <wa-copy-button
            value=${link}
            copy-label=${TEXT.copyLink}
          ></wa-copy-button>
        </div>
      </div>
    `;
  }

  #onMarkdownChange(event: CustomEvent<string>): void {
    this.#markdown = event.detail;
  }

  #onNameInput(event: Event): void {
    this.#name = documentName(inputValue(event));
    this.#check();
  }

  #onPublisherInput(event: Event): void {
    this.#publisher = documentName(inputValue(event));
    this.#check();
  }

  /** Works out whether the wallet may publish the names typed. */
  #check(): void {
    this.#checkRequest += 1;
    const blocked = this.#walletBlocker();
    if (blocked !== null) {
      this.#readiness = blocked;
      return;
    }
    this.#readiness = { kind: "CHECKING" };
    void this.#checkChain(this.#checkRequest);
  }

  /**
   * Why the wallet or the names typed cannot publish, before asking the
   * chain, or null when nothing stands in the way yet.
   */
  #walletBlocker(): BlockedState | null {
    const wallet = this.#wallet;
    if (!wallet.isAvailable || wallet.state.account === null) {
      return { kind: "BLOCKED", hint: TEXT.publishConnect };
    }
    if (wallet.state.chainId !== WALLET_CHAIN.id) {
      return { kind: "BLOCKED", hint: TEXT.publishSwitch };
    }
    const isComplete = (name: string): boolean => name.endsWith(".eth");
    if (!isComplete(this.#name) || !isComplete(this.#publisher)) {
      return BLOCKED;
    }
    return null;
  }

  async #checkChain(request: number): Promise<void> {
    const readiness = await this.#readinessOnChain().catch(
      (): Readiness => ({ kind: "BLOCKED", hint: TEXT.publishUnreachable }),
    );
    if (request === this.#checkRequest) {
      this.#readiness = readiness;
    }
  }

  async #readinessOnChain(): Promise<Readiness> {
    const { publish, permissions } = this.#engines;
    const rpcUrl = this.#settings.settings.rpcUrl;
    const account = this.#wallet.state.account;
    const name = this.#name;
    const publisher = this.#publisher;
    if (account === null) {
      return { kind: "BLOCKED", hint: TEXT.publishConnect };
    }
    if (!await publish.mayPublish(publisher, name)) {
      return { kind: "BLOCKED", hint: TEXT.publishNotAllowed(publisher, name) };
    }
    const owner = await permissions.owner(publisher, rpcUrl);
    if (owner?.toLowerCase() !== account.toLowerCase()) {
      return { kind: "BLOCKED", hint: TEXT.publishNotOwner(publisher) };
    }
    switch (await publish.recordAccess(name, account, rpcUrl)) {
      case "WRITABLE":
        return { kind: "READY" };
      case "NO_RESOLVER":
        return { kind: "BLOCKED", hint: TEXT.publishNoResolver(name) };
      case "DENIED":
        return { kind: "BLOCKED", hint: TEXT.publishDenied(name) };
    }
  }

  /** Sends the file, then points the name's record at it. */
  async #publish(): Promise<void> {
    const engine = this.#engines.publish;
    const rpcUrl = this.#settings.settings.rpcUrl;
    const name = this.#name;
    this.#published = "";
    this.#fileStep = { ...IDLE_STEP, isPending: true };
    this.#recordStep = IDLE_STEP;
    let file: Transaction;
    try {
      file = await engine.publish(this.#publisher, this.#markdown);
      this.#fileStep = { ...this.#fileStep, transaction: file };
      await engine.confirm(file, rpcUrl);
      this.#fileStep = { ...this.#fileStep, isPending: false };
    } catch {
      this.#fileStep = { ...this.#fileStep, isPending: false, hasFailed: true };
      return;
    }
    this.#recordStep = { ...IDLE_STEP, isPending: true };
    try {
      const record = await engine.setRecord(name, file, rpcUrl);
      this.#recordStep = { ...this.#recordStep, transaction: record };
      await engine.confirm(record, rpcUrl);
      this.#recordStep = { ...this.#recordStep, isPending: false };
      this.#published = name;
    } catch {
      this.#recordStep = {
        ...this.#recordStep,
        isPending: false,
        hasFailed: true,
      };
    }
  }
}

/** The value of the input an event came from. */
function inputValue(event: Event): string {
  const input = event.currentTarget;
  return input instanceof WaInput ? input.value ?? "" : "";
}
