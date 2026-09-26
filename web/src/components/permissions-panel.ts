import "@awesome.me/webawesome/dist/components/divider/divider.js";
import "@awesome.me/webawesome/dist/components/spinner/spinner.js";
import { consume } from "@lit/context";
import { css, html, LitElement, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { Address } from "viem";

import { ROLE_REGISTRAR, ROLE_UNREGISTER, TEXT } from "#constants";
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

/** The root roles one account holds on one parent's registry. */
interface RootRoles {
  parentName: string;
  account: Address | null;
  canGrant: boolean;
  canRevoke: boolean;
}

/** What the connected wallet may do, and why not when it may not. */
interface Access {
  canGrant: boolean;
  canRevoke: boolean;
  hint: string | null;
}

const NO_ROLES: RootRoles = {
  parentName: "",
  account: null,
  canGrant: false,
  canRevoke: false,
};

/**
 * Lists the parent name's members as ENSv2 on Sepolia reports them, and lets
 * the parent's owner, or an account holding the registrar or unregister root
 * role on its registry, grant and revoke them from the connected wallet.
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
  @syncAfterSet((host: PermissionsPanelElement): void => {
    void host.#loadRoles();
  })
  accessor #wallet: WalletContext = EMPTY_WALLET_CONTEXT;

  /** Who owns the parent name, or null while unknown or unowned. */
  @state()
  accessor #parentOwner: Address | null = null;

  /** The wallet account's root roles on the parent's registry. */
  @state()
  accessor #roles: RootRoles = NO_ROLES;

  @state()
  accessor #members: Member[] = [];

  @state()
  accessor #isLoading: boolean = false;

  @state()
  accessor #hasFailed: boolean = false;

  #loadRequest = 0;

  #rolesRequest = 0;

  override render(): TemplateResult {
    const parentName = this.#settings.settings.parentName;
    const error = this.#hasFailed
      ? html`
        <div class="error" role="alert">${TEXT.loadFailed}</div>
      `
      : html``;
    const parentLine = TEXT.parentName(parentName);
    const access = this.#access(parentName);
    const rows = this.#renderRows(access.canRevoke);
    const hintLine = access.hint === null ? html`` : html`
      <div class="hint">${access.hint}</div>
    `;
    return html`
      <div>
        <h2>${TEXT.permissions}</h2>
        <div class="parent">${parentLine}</div>
      </div>
      ${error}
      <div>${rows}</div>
      <wa-divider></wa-divider>
      <md-grant-form .canGrant=${access.canGrant}></md-grant-form>
      ${hintLine}
    `;
  }

  /** What the wallet may do for the parent, and why not when it may not. */
  #access(parentName: string): Access {
    const wallet = this.#wallet;
    const account = wallet.state.account;
    if (!wallet.isAvailable || account === null) {
      return denied(TEXT.connectToManage(parentName));
    }
    if (wallet.state.chainId !== WALLET_CHAIN.id) {
      return denied(TEXT.switchToManage);
    }
    const owner = this.#parentOwner;
    if (owner === null) {
      return denied(TEXT.parentUnowned(parentName));
    }
    if (owner.toLowerCase() === account.toLowerCase()) {
      return { canGrant: true, canRevoke: true, hint: null };
    }
    const roles = this.#roles;
    const isCurrent = roles.parentName === parentName &&
      roles.account === account;
    const canGrant = isCurrent && roles.canGrant;
    const canRevoke = isCurrent && roles.canRevoke;
    if (canGrant && canRevoke) {
      return { canGrant, canRevoke, hint: null };
    }
    if (canGrant) {
      return { canGrant, canRevoke, hint: TEXT.cannotRevoke(parentName) };
    }
    if (canRevoke) {
      return { canGrant, canRevoke, hint: TEXT.cannotGrant(parentName) };
    }
    const hint = TEXT.cannotGrantOrRevoke(parentName, shortAddress(owner));
    return { canGrant, canRevoke, hint };
  }

  #renderRows(canRevoke: boolean): TemplateResult[] | TemplateResult {
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
          .canRevoke=${canRevoke}
        ></md-member-row>
      `
    );
  }

  /** Reads the wallet account's root roles on the parent's registry. */
  async #loadRoles(): Promise<void> {
    this.#rolesRequest += 1;
    const request = this.#rolesRequest;
    const { parentName, rpcUrl } = this.#settings.settings;
    const account = this.#wallet.state.account;
    if (account === null) {
      this.#roles = NO_ROLES;
      return;
    }
    const engine = this.#engines.permissions;
    try {
      const [canGrant, canRevoke] = await Promise.all([
        engine.hasRootRoles(parentName, ROLE_REGISTRAR, account, rpcUrl),
        engine.hasRootRoles(parentName, ROLE_UNREGISTER, account, rpcUrl),
      ]);
      if (request === this.#rolesRequest) {
        this.#roles = { parentName, account, canGrant, canRevoke };
      }
    } catch {
      if (request === this.#rolesRequest) {
        this.#roles = NO_ROLES;
      }
    }
  }

  async #load(): Promise<void> {
    void this.#loadRoles();
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

/** Access that allows nothing, with the reason shown to the user. */
function denied(hint: string): Access {
  return { canGrant: false, canRevoke: false, hint };
}
