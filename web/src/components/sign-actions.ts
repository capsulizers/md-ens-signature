import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
import WaInput from "@awesome.me/webawesome/dist/components/input/input.js";
import { consume } from "@lit/context";
import { css, html, LitElement, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { SIGNED_FILE_NAME, TEXT } from "#constants";
import { EMPTY_ENGINES, type Engines, enginesContext } from "#context";
import { hasWallet, signWithWallet, type Verdict } from "#engine";

declare global {
  interface HTMLElementTagNameMap {
    "md-sign-actions": SignActionsElement;
  }

  interface HTMLElementEventMap {
    "markdown-change": CustomEvent<string>;
  }
}

/** Signs the open file with a browser wallet and saves the signed copy. */
@customElement("md-sign-actions")
export class SignActionsElement extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--wa-space-xs);
    }

    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: var(--wa-space-s);
    }

    wa-input {
      flex: 1 1 10rem;
      min-width: 0;
    }

    .hint {
      color: var(--wa-color-text-quiet);
      font-size: var(--wa-font-size-s);
    }

    .error {
      color: var(--wa-color-danger-on-quiet);
      font-size: var(--wa-font-size-s);
    }
  `;

  /** The file's current text. */
  @property({ attribute: false })
  accessor markdown: string = "";

  /** What verifying the file concluded, or null while it is checked. */
  @property({ attribute: false })
  accessor verdict: Verdict | null = null;

  @consume({ context: enginesContext, subscribe: true })
  accessor #engines: Engines = EMPTY_ENGINES;

  @state()
  accessor #signer: string = "";

  @state()
  accessor #isSigning: boolean = false;

  @state()
  accessor #hasFailed: boolean = false;

  override render(): TemplateResult {
    const walletReady = hasWallet();
    const isSignDisabled = !walletReady || this.#signer === "" ||
      this.markdown.trim() === "";
    const isDownloadDisabled = this.verdict === null ||
      this.verdict.kind === "unsigned";
    const note = this.#note(walletReady);
    return html`
      <div class="row">
        <wa-input
          label=${TEXT.signerLabel}
          placeholder=${TEXT.signerPlaceholder}
          .value=${this.#signer}
          @input=${this.#onSignerInput}
        ></wa-input>
        <wa-button
          variant="brand"
          ?disabled=${isSignDisabled}
          ?loading=${this.#isSigning}
          @click=${this.#sign}
        >
          <wa-icon slot="start" name="pen"></wa-icon>
          ${TEXT.sign}
        </wa-button>
        <wa-button
          appearance="outlined"
          ?disabled=${isDownloadDisabled}
          @click=${this.#download}
        >
          <wa-icon slot="start" name="download"></wa-icon>
          ${TEXT.download}
        </wa-button>
      </div>
      ${note}
    `;
  }

  #note(walletReady: boolean): TemplateResult {
    if (this.#hasFailed) {
      return html`
        <div class="error" role="alert">${TEXT.signFailed}</div>
      `;
    }
    if (!walletReady) {
      return html`
        <div class="hint">${TEXT.noWalletHint}</div>
      `;
    }
    return html``;
  }

  #onSignerInput(event: Event): void {
    const input = event.currentTarget;
    if (input instanceof WaInput) {
      this.#signer = (input.value ?? "").trim().toLowerCase();
    }
  }

  async #sign(): Promise<void> {
    const engine = this.#engines.signature;
    const markdown = this.markdown;
    const signer = this.#signer;
    this.#isSigning = true;
    this.#hasFailed = false;
    try {
      const message = await engine.message(markdown, signer);
      const signature = await signWithWallet(message);
      const signed = await engine.attach(markdown, signer, signature);
      this.dispatchEvent(
        new CustomEvent<string>("markdown-change", { detail: signed }),
      );
    } catch {
      this.#hasFailed = true;
    } finally {
      this.#isSigning = false;
    }
  }

  #download(): void {
    const link = document.createElement("a");
    link.href = `data:text/markdown;charset=utf-8,${
      encodeURIComponent(this.markdown)
    }`;
    link.download = SIGNED_FILE_NAME;
    link.click();
  }
}
