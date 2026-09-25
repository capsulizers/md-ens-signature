import "@awesome.me/webawesome/dist/components/icon/icon.js";
import "@awesome.me/webawesome/dist/components/spinner/spinner.js";
import { css, html, LitElement, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";

import { ETHERSCAN_TX_URL, TEXT } from "#constants";
import type { Transaction } from "#engine";

declare global {
  interface HTMLElementTagNameMap {
    "md-transaction-note": TransactionNoteElement;
  }
}

/** Where a sent transaction stands, with its Sepolia Etherscan link. */
@customElement("md-transaction-note")
export class TransactionNoteElement extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--wa-space-2xs);
      color: var(--wa-color-text-quiet);
      font-size: var(--wa-font-size-s);
    }

    :host > * {
      white-space: nowrap;
    }

    .error {
      color: var(--wa-color-danger-on-quiet);
      white-space: normal;
    }

    a {
      color: var(--wa-color-text-link);
    }
  `;

  /** The transaction sent, or null before the wallet has sent one. */
  @property({ attribute: false })
  accessor transaction: Transaction | null = null;

  /** Whether the transaction is still being sent or confirmed. */
  @property({ attribute: false })
  accessor isPending: boolean = false;

  /** Whether sending or confirming failed. */
  @property({ attribute: false })
  accessor hasFailed: boolean = false;

  override render(): TemplateResult {
    const waiting = this.#waiting();
    const error = this.hasFailed
      ? html`
        <span class="error" role="alert">${TEXT.transactionFailed}</span>
      `
      : html``;
    const link = this.#link();
    return html`
      ${waiting} ${error} ${link}
    `;
  }

  #waiting(): TemplateResult {
    if (!this.isPending) {
      return html``;
    }
    const text = this.transaction === null
      ? TEXT.waitingForWallet
      : TEXT.waitingForConfirmation;
    return html`
      <wa-spinner></wa-spinner>
      <span>${text}</span>
    `;
  }

  #link(): TemplateResult {
    if (this.transaction === null) {
      return html``;
    }
    const url = `${ETHERSCAN_TX_URL}${this.transaction.hash}`;
    return html`
      <a href=${url} target="_blank" rel="noopener noreferrer">
        ${TEXT.viewTransaction}
        <wa-icon name="box-arrow-up-right"></wa-icon>
      </a>
    `;
  }
}
