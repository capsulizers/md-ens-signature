import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/divider/divider.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
import WaInput from "@awesome.me/webawesome/dist/components/input/input.js";
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
import type { Member, MemberStatus } from "#engine";
import { syncAfterSet } from "#utils";

import "./member-row.ts";

declare global {
  interface HTMLElementTagNameMap {
    "md-permissions-panel": PermissionsPanelElement;
  }
}

/** A row to draw: a member, or a name added here and not yet granted. */
interface MemberEntry {
  name: string;
  status: MemberStatus | null;
}

/** Lists the parent name's members and lets its owner grant or revoke them. */
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
    .empty {
      color: var(--wa-color-text-quiet);
      font-size: var(--wa-font-size-s);
    }

    .error {
      color: var(--wa-color-danger-on-quiet);
      font-size: var(--wa-font-size-s);
    }

    md-member-row + md-member-row {
      border-top: var(--wa-border-width-s) solid var(--wa-color-surface-border);
    }

    .add {
      display: flex;
      align-items: end;
      gap: var(--wa-space-s);
    }

    .add wa-input {
      flex: 1;
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

  /** Names added here that have not been granted yet. */
  @state()
  accessor #newNames: string[] = [];

  @state()
  accessor #newLabel: string = "";

  @state()
  accessor #hasFailed: boolean = false;

  #loadRequest = 0;

  override render(): TemplateResult {
    const parentName = this.#settings.settings.parentName;
    const rows = this.#renderRows(parentName);
    const error = this.#hasFailed
      ? html`
        <div class="error" role="alert">${TEXT.loadFailed}</div>
      `
      : html``;
    const isAddDisabled = this.#newLabel === "";
    const parentLine = TEXT.parentName(parentName);
    return html`
      <div>
        <h2>${TEXT.permissions}</h2>
        <div class="parent">${parentLine}</div>
      </div>
      ${error}
      <div>${rows}</div>
      <wa-divider></wa-divider>
      <div class="add">
        <wa-input
          size="s"
          label=${TEXT.newMemberLabel}
          placeholder=${TEXT.newMemberPlaceholder}
          .value=${this.#newLabel}
          @input=${this.#onNewLabelInput}
          @keydown=${this.#onNewLabelKeyDown}
        ></wa-input>
        <wa-button size="s" ?disabled=${isAddDisabled} @click=${this.#add}>
          <wa-icon slot="start" name="person-plus"></wa-icon>
          ${TEXT.addMember}
        </wa-button>
      </div>
    `;
  }

  #renderRows(parentName: string): TemplateResult[] | TemplateResult {
    const known = new Set(
      this.#members.map((member: Member): string => member.name),
    );
    const entries: MemberEntry[] = [
      ...this.#members,
      ...this.#newNames
        .filter((name: string): boolean => !known.has(name))
        .map((name: string): MemberEntry => ({ name, status: null })),
    ];
    if (entries.length === 0) {
      return html`
        <div class="empty">${TEXT.noMembers}</div>
      `;
    }
    return entries.map((entry: MemberEntry): TemplateResult =>
      html`
        <md-member-row
          .name=${entry.name}
          .status=${entry.status}
          .parentName=${parentName}
        ></md-member-row>
      `
    );
  }

  async #load(): Promise<void> {
    this.#loadRequest += 1;
    const request = this.#loadRequest;
    const settings = this.#settings.settings;
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
    }
  }

  #onNewLabelInput(event: Event): void {
    const input = event.currentTarget;
    if (input instanceof WaInput) {
      this.#newLabel = (input.value ?? "").trim().toLowerCase();
    }
  }

  #onNewLabelKeyDown(event: KeyboardEvent): void {
    if (event.key === "Enter" && this.#newLabel !== "") {
      this.#add();
    }
  }

  /** Adds a row for the typed name, completing a bare label with the parent. */
  #add(): void {
    const parentName = this.#settings.settings.parentName;
    const suffix = `.${parentName}`;
    const name = this.#newLabel.endsWith(suffix)
      ? this.#newLabel
      : `${this.#newLabel}${suffix}`;
    if (!this.#newNames.includes(name)) {
      this.#newNames = [...this.#newNames, name];
    }
    this.#newLabel = "";
  }
}
