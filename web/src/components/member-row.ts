import "@awesome.me/webawesome/dist/components/badge/badge.js";
import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
import "@awesome.me/webawesome/dist/components/spinner/spinner.js";
import { consume } from "@lit/context";
import { css, html, LitElement, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { ETHERSCAN_TX_URL, TEXT } from "#constants";
import { EMPTY_ENGINES, type Engines, enginesContext } from "#context";
import type { MemberStatus, Transaction } from "#engine";

declare global {
  interface HTMLElementTagNameMap {
    "md-member-row": MemberRowElement;
  }
}

/** One member with its status and the transactions that change it. */
@customElement("md-member-row")
export class MemberRowElement extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--wa-space-2xs);
      padding: var(--wa-space-s) 0;
    }

    .row {
      display: flex;
      align-items: center;
      gap: var(--wa-space-s);
    }

    .who {
      display: flex;
      flex: 1;
      flex-direction: column;
      align-items: start;
      gap: var(--wa-space-2xs);
      min-width: 0;
    }

    .name {
      overflow-wrap: anywhere;
      font-weight: var(--wa-font-weight-semibold);
    }

    .actions {
      display: flex;
      flex: none;
      gap: var(--wa-space-xs);
    }

    .note {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--wa-space-2xs);
      color: var(--wa-color-text-quiet);
      font-size: var(--wa-font-size-s);
    }

    .error {
      color: var(--wa-color-danger-on-quiet);
      font-size: var(--wa-font-size-s);
    }

    .note > * {
      white-space: nowrap;
    }

    a {
      color: var(--wa-color-text-link);
    }
  `;

  /** The member's full ENS name. */
  @property({ attribute: false })
  accessor name: string = "";

  /** The member's status, or null when it has never been granted. */
  @property({ attribute: false })
  accessor status: MemberStatus | null = null;

  /** The parent name the member belongs to. */
  @property({ attribute: false })
  accessor parentName: string = "";

  @consume({ context: enginesContext, subscribe: true })
  accessor #engines: Engines = EMPTY_ENGINES;

  @state()
  accessor #transaction: Transaction | null = null;

  @state()
  accessor #isPending: boolean = false;

  @state()
  accessor #hasFailed: boolean = false;

  override render(): TemplateResult {
    const chip = this.#chip();
    const isGrantDisabled = this.#isPending || this.status === "GRANTED";
    const isRevokeDisabled = this.#isPending || this.status !== "GRANTED";
    const note = this.#note();
    return html`
      <div class="row">
        <div class="who">
          <span class="name">${this.name}</span>
          ${chip}
        </div>
        <div class="actions">
          <wa-button
            size="s"
            appearance="outlined"
            ?disabled=${isGrantDisabled}
            @click=${this.#grant}
          >
          <wa-icon slot="start" name="person-check"></wa-icon>
          ${TEXT.grant}
        </wa-button>
          <wa-button
            size="s"
            appearance="outlined"
            variant="danger"
            ?disabled=${isRevokeDisabled}
            @click=${this.#revoke}
          >
          <wa-icon slot="start" name="person-x"></wa-icon>
          ${TEXT.revoke}
        </wa-button>
        </div>
      </div>
      ${note}
    `;
  }

  #chip(): TemplateResult {
    if (this.#isPending) {
      return html`
        <wa-badge variant="neutral" pill>${TEXT.pending}</wa-badge>
      `;
    }
    switch (this.status) {
      case "GRANTED":
        return html`
          <wa-badge variant="success" pill>${TEXT.granted}</wa-badge>
        `;
      case "REVOKED":
        return html`
          <wa-badge variant="danger" pill>${TEXT.revoked}</wa-badge>
        `;
      case null:
        return html`
          <wa-badge variant="neutral" pill>${TEXT.notMember}</wa-badge>
        `;
    }
  }

  #note(): TemplateResult {
    if (this.#hasFailed) {
      return html`
        <div class="error" role="alert">${TEXT.transactionFailed}</div>
      `;
    }
    if (this.#transaction === null) {
      return html``;
    }
    const url = `${ETHERSCAN_TX_URL}${this.#transaction.hash}`;
    const waiting = this.#isPending
      ? html`
        <wa-spinner></wa-spinner>
        <span>${TEXT.waitingForConfirmation}</span>
      `
      : html``;
    return html`
      <div class="note">
        ${waiting}
        <a href=${url} target="_blank" rel="noopener noreferrer">
          ${TEXT.viewTransaction}
          <wa-icon name="box-arrow-up-right"></wa-icon>
        </a>
      </div>
    `;
  }

  #grant(): void {
    const engine = this.#engines.permissions;
    void this.#send(engine.grant(this.parentName, this.name));
  }

  #revoke(): void {
    const engine = this.#engines.permissions;
    void this.#send(engine.revoke(this.parentName, this.name));
  }

  /** Waits for a sent transaction to confirm, then has readers check again. */
  async #send(sending: Promise<Transaction>): Promise<void> {
    const engines = this.#engines;
    this.#isPending = true;
    this.#hasFailed = false;
    this.#transaction = null;
    try {
      this.#transaction = await sending;
      await engines.permissions.confirm(this.#transaction);
      engines.notifyChanged();
    } catch {
      this.#hasFailed = true;
    } finally {
      this.#isPending = false;
    }
  }
}
