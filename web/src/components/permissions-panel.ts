import "@awesome.me/webawesome/dist/components/spinner/spinner.js";
import { consume } from "@lit/context";
import { css, html, LitElement, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";

import { TEXT } from "#constants";
import {
  EMPTY_ENGINES,
  EMPTY_SETTINGS_CONTEXT,
  type Engines,
  enginesContext,
  type SettingsContext,
  settingsContext,
} from "#context";
import type { Member } from "#engine";
import { syncAfterSet } from "#utils";

import "./member-row.ts";

declare global {
  interface HTMLElementTagNameMap {
    "md-permissions-panel": PermissionsPanelElement;
  }
}

/** Lists the parent name's members as ENSv2 on Sepolia reports them. */
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
    .loading {
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

  @state()
  accessor #members: Member[] = [];

  @state()
  accessor #isLoading: boolean = false;

  @state()
  accessor #hasFailed: boolean = false;

  #loadRequest = 0;

  override render(): TemplateResult {
    const parentName = this.#settings.settings.parentName;
    const rows = this.#renderRows();
    const error = this.#hasFailed
      ? html`
        <div class="error" role="alert">${TEXT.loadFailed}</div>
      `
      : html``;
    const parentLine = TEXT.parentName(parentName);
    return html`
      <div>
        <h2>${TEXT.permissions}</h2>
        <div class="parent">${parentLine}</div>
      </div>
      ${error}
      <div>${rows}</div>
    `;
  }

  #renderRows(): TemplateResult[] | TemplateResult {
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
        <md-member-row .member=${member}></md-member-row>
      `
    );
  }

  async #load(): Promise<void> {
    this.#loadRequest += 1;
    const request = this.#loadRequest;
    const settings = this.#settings.settings;
    this.#isLoading = true;
    try {
      const members = await this.#engines.permissions.members(
        settings.parentName,
        settings.rpcUrl,
      );
      if (request === this.#loadRequest) {
        this.#members = members;
        this.#hasFailed = false;
      }
    } catch {
      if (request === this.#loadRequest) {
        this.#members = [];
        this.#hasFailed = true;
      }
    } finally {
      if (request === this.#loadRequest) {
        this.#isLoading = false;
      }
    }
  }
}
