import "@awesome.me/webawesome/dist/components/divider/divider.js";
import "@awesome.me/webawesome/dist/components/spinner/spinner.js";
import { consume } from "@lit/context";
import { css, html, LitElement, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { Address } from "viem";

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
import { type Member, WALLET_CHAIN } from "#engine";
import { shortAddress, syncAfterSet } from "#utils";

import "./grant-form.ts";
import "./member-row.ts";

declare global {
  interface HTMLElementTagNameMap {
    "md-permissions-panel": PermissionsPanelElement;
  }
}

/**
 * Lists the parent name's members as ENSv2 on Sepolia reports them, and lets
 * the parent's owner grant and revoke them from the connected wallet.
 */
@customElement("md-permissions-panel")
export class PermissionsPanelElement extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--wa-space-s);
      padding: var(--wa-space-l);
      border: var(--wa-border-width-s) solid var(--wa-color-surface-border);
      border-radius: var(--wa-border-radius-l);
      background: var(--wa-color-surface-default);
    }

    h2 {
      margin: 0;
      font-size: var(--wa-font-size-l);
    }

    .parent,
    .empty,
    .loading,
    .hint {
      color: var(--wa-color-text-quiet);
      font-size: var(--wa-font-size-s);
    }

    .error {
      color: var(--wa-color-danger-on-quiet);
      font-size: var(--wa-font-size-s);
    }

    .loading {
      display: flex;
      align-items: center;
      gap: var(--wa-space-xs);
    }

    md-member-row + md-member-row {
      border-top: var(--wa-border-width-s) solid var(--wa-color-surface-border);
    }
  `;

  @consume({ context: enginesContext, subscribe: true })
  @syncAfterSet((host: PermissionsPanelElement): void => {
    void host.#load();
  })
  accessor #engines: Engines = EMPTY_ENGINES;

  @consume({ context: settingsContext, subscribe: true })
  @syncAfterSet((host: PermissionsPanelElement): void => {
    void host.#load();
  })
  accessor #settings: SettingsContext = EMPTY_SETTINGS_CONTEXT;

  @consume({ context: walletContext, subscribe: true })
  accessor #wallet: WalletContext = EMPTY_WALLET_CONTEXT;

  /** Who owns the parent name, or null while unknown or unowned. */
  @state()
  accessor #parentOwner: Address | null = null;

  @state()
  accessor #members: Member[] = [];

  @state()
  accessor #isLoading: boolean = false;

  @state()
  accessor #hasFailed: boolean = false;

  #loadRequest = 0;

  override render(): TemplateResult {
    const parentName = this.#settings.settings.parentName;
    const error = this.#hasFailed
      ? html`
        <div class="error" role="alert">${TEXT.loadFailed}</div>
      `
      : html``;
    const parentLine = TEXT.parentName(parentName);
    const hint = this.#hint(parentName);
    const canManage = hint === null;
    const rows = this.#renderRows(canManage);
    const hintLine = hint === null ? html`` : html`
      <div class="hint">${hint}</div>
    `;
    return html`
      <div>
        <h2>${TEXT.permissions}</h2>
        <div class="parent">${parentLine}</div>
      </div>
      ${error}
      <div>${rows}</div>
      <wa-divider></wa-divider>
      <md-grant-form .canManage=${canManage}></md-grant-form>
      ${hintLine}
    `;
  }

  /** Why the wallet cannot grant or revoke, or null when it can. */
  #hint(parentName: string): string | null {
    const wallet = this.#wallet;
    const account = wallet.state.account;
    if (!wallet.isAvailable || account === null) {
      return TEXT.connectToManage(parentName);
    }
    if (wallet.state.chainId !== WALLET_CHAIN.id) {
      return TEXT.switchToManage;
    }
    const owner = this.#parentOwner;
    if (owner === null) {
      return TEXT.parentUnowned(parentName);
    }
    if (owner.toLowerCase() !== account.toLowerCase()) {
      return TEXT.notParentOwner(parentName, shortAddress(owner));
    }
    return null;
  }

  #renderRows(canManage: boolean): TemplateResult[] | TemplateResult {
    if (this.#isLoading && this.#members.length === 0) {
      return html`
        <div class="loading">
          <wa-spinner></wa-spinner>
          ${TEXT.loadingMembers}
        </div>
      `;
    }
    if (this.#hasFailed) {
      return html``;
    }
    if (this.#members.length === 0) {
      return html`
        <div class="empty">${TEXT.noMembers}</div>
      `;
    }
    return this.#members.map((member: Member): TemplateResult =>
      html`
        <md-member-row
          .member=${member}
          .canManage=${canManage}
        ></md-member-row>
      `
    );
  }

  async #load(): Promise<void> {
    this.#loadRequest += 1;
    const request = this.#loadRequest;
    const settings = this.#settings.settings;
    this.#isLoading = true;
    try {
      const engine = this.#engines.permissions;
      const [members, parentOwner] = await Promise.all([
        engine.members(settings.parentName, settings.rpcUrl),
        engine.owner(settings.parentName, settings.rpcUrl),
      ]);
      if (request === this.#loadRequest) {
        this.#members = members;
        this.#parentOwner = parentOwner;
        this.#hasFailed = false;
      }
    } catch {
      if (request === this.#loadRequest) {
        this.#members = [];
        this.#parentOwner = null;
        this.#hasFailed = true;
      }
    } finally {
      if (request === this.#loadRequest) {
        this.#isLoading = false;
      }
    }
  }
}
