import "@awesome.me/webawesome/dist/components/badge/badge.js";
import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
import { consume } from "@lit/context";
import { css, html, LitElement, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { ETHERSCAN_ADDRESS_URL, TEXT } from "#constants";
import {
  EMPTY_ENGINES,
  EMPTY_SETTINGS_CONTEXT,
  type Engines,
  enginesContext,
  type SettingsContext,
  settingsContext,
} from "#context";
import type { Member, Transaction } from "#engine";
import { shortAddress } from "#utils";

import "./transaction-note.ts";

declare global {
  interface HTMLElementTagNameMap {
    "md-member-row": MemberRowElement;
  }
}

/** One member with its owner, its status, and a way to revoke it. */
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

    .owner {
      color: var(--wa-color-text-quiet);
      font-size: var(--wa-font-size-s);
    }

    a {
      color: var(--wa-color-text-link);
      font-family: var(--wa-font-family-code);
    }
  `;

  /** The member as the chain reports it. */
  @property({ attribute: false })
  accessor member: Member | null = null;

  /** Whether the connected wallet may revoke for the parent. */
  @property({ attribute: false })
  accessor canRevoke: boolean = false;

  @consume({ context: enginesContext, subscribe: true })
  accessor #engines: Engines = EMPTY_ENGINES;

  @consume({ context: settingsContext, subscribe: true })
  accessor #settings: SettingsContext = EMPTY_SETTINGS_CONTEXT;

  @state()
  accessor #transaction: Transaction | null = null;

  @state()
  accessor #isPending: boolean = false;

  @state()
  accessor #hasFailed: boolean = false;

  override render(): TemplateResult {
    const member = this.member;
    if (member === null) {
      return html``;
    }
    const owner = this.#owner(member);
    const chip = this.#chip(member);
    const isRevokeDisabled = !this.canRevoke || this.#isPending ||
      member.status !== "GRANTED";
    return html`
      <div class="row">
        <div class="who">
          <span class="name">${member.name}</span>
          ${owner}
        </div>
        ${chip}
        <wa-button
          size="s"
          appearance="outlined"
          variant="danger"
          ?disabled=${isRevokeDisabled}
          ?loading=${this.#isPending}
          @click=${this.#revoke}
        >
          <wa-icon slot="start" name="person-x"></wa-icon>
          ${TEXT.revoke}
        </wa-button>
      </div>
      <md-transaction-note
        .transaction=${this.#transaction}
        .isPending=${this.#isPending}
        .hasFailed=${this.#hasFailed}
      ></md-transaction-note>
    `;
  }

  #chip(member: Member): TemplateResult {
    if (this.#isPending) {
      return html`
        <wa-badge variant="neutral" pill>${TEXT.pending}</wa-badge>
      `;
    }
    return member.status === "GRANTED"
      ? html`
        <wa-badge variant="success" pill>${TEXT.granted}</wa-badge>
      `
      : html`
        <wa-badge variant="danger" pill>${TEXT.revoked}</wa-badge>
      `;
  }

  #owner(member: Member): TemplateResult {
    if (member.owner === null) {
      return html`
        <span class="owner">${TEXT.noOwner}</span>
      `;
    }
    const url = `${ETHERSCAN_ADDRESS_URL}${member.owner}`;
    const short = shortAddress(member.owner);
    return html`
      <span class="owner">
        ${TEXT.ownedBy}
        <a href=${url} target="_blank" rel="noopener noreferrer">${short}</a>
      </span>
    `;
  }

  /** Sends the revoke, waits for it, then has every reader check again. */
  async #revoke(): Promise<void> {
    const member = this.member;
    if (member === null) {
      return;
    }
    const engines = this.#engines;
    const settings = this.#settings.settings;
    this.#isPending = true;
    this.#hasFailed = false;
    this.#transaction = null;
    try {
      this.#transaction = await engines.permissions.revoke(
        settings.parentName,
        member.label,
        settings.rpcUrl,
      );
      await engines.permissions.confirm(this.#transaction, settings.rpcUrl);
      engines.notifyChanged();
    } catch {
      this.#hasFailed = true;
    } finally {
      this.#isPending = false;
    }
  }
}
