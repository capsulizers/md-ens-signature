import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
import WaInput from "@awesome.me/webawesome/dist/components/input/input.js";
import { consume } from "@lit/context";
import { css, html, LitElement, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { isAddress } from "viem";

import { TEXT } from "#constants";
import {
  EMPTY_ENGINES,
  EMPTY_SETTINGS_CONTEXT,
  type Engines,
  enginesContext,
  type SettingsContext,
  settingsContext,
} from "#context";
import type { Transaction } from "#engine";

import "./transaction-note.ts";

declare global {
  interface HTMLElementTagNameMap {
    "md-grant-form": GrantFormElement;
  }
}

/** Grants a new member name to an address with one Sepolia transaction. */
@customElement("md-grant-form")
export class GrantFormElement extends LitElement {
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

    .label {
      flex: 1 1 6rem;
    }

    .address {
      flex: 3 1 12rem;
    }
  `;

  /** Whether the connected wallet may grant for the parent. */
  @property({ attribute: false })
  accessor canGrant: boolean = false;

  @consume({ context: enginesContext, subscribe: true })
  accessor #engines: Engines = EMPTY_ENGINES;

  @consume({ context: settingsContext, subscribe: true })
  accessor #settings: SettingsContext = EMPTY_SETTINGS_CONTEXT;

  @state()
  accessor #label: string = "";

  @state()
  accessor #address: string = "";

  @state()
  accessor #transaction: Transaction | null = null;

  @state()
  accessor #isPending: boolean = false;

  @state()
  accessor #hasFailed: boolean = false;

  override render(): TemplateResult {
    const isLabelValid = this.#label !== "" && !this.#label.includes(".");
    const isGrantDisabled = !this.canGrant || this.#isPending ||
      !isLabelValid || !isAddress(this.#address);
    const isInputDisabled = !this.canGrant;
    return html`
      <div class="row">
        <wa-input
          class="label"
          size="s"
          label=${TEXT.memberLabel}
          placeholder=${TEXT.memberLabelPlaceholder}
          ?disabled=${isInputDisabled}
          .value=${this.#label}
          @input=${this.#onLabelInput}
        ></wa-input>
        <wa-input
          class="address"
          size="s"
          label=${TEXT.memberAddress}
          placeholder=${TEXT.memberAddressPlaceholder}
          ?disabled=${isInputDisabled}
          .value=${this.#address}
          @input=${this.#onAddressInput}
        ></wa-input>
        <wa-button
          size="s"
          variant="brand"
          ?disabled=${isGrantDisabled}
          ?loading=${this.#isPending}
          @click=${this.#grant}
        >
          <wa-icon slot="start" name="person-plus"></wa-icon>
          ${TEXT.grant}
        </wa-button>
      </div>
      <md-transaction-note
        .transaction=${this.#transaction}
        .isPending=${this.#isPending}
        .hasFailed=${this.#hasFailed}
      ></md-transaction-note>
    `;
  }

  #onLabelInput(event: Event): void {
    const input = event.currentTarget;
    if (input instanceof WaInput) {
      this.#label = (input.value ?? "").trim().toLowerCase();
    }
  }

  #onAddressInput(event: Event): void {
    const input = event.currentTarget;
    if (input instanceof WaInput) {
      this.#address = (input.value ?? "").trim();
    }
  }

  /** Sends the grant, waits for it, then has every reader check again. */
  async #grant(): Promise<void> {
    const engines = this.#engines;
    const settings = this.#settings.settings;
    const address = this.#address;
    if (!isAddress(address)) {
      return;
    }
    this.#isPending = true;
    this.#hasFailed = false;
    this.#transaction = null;
    try {
      this.#transaction = await engines.permissions.grant(
        settings.parentName,
        this.#label,
        address,
        settings.rpcUrl,
      );
      await engines.permissions.confirm(this.#transaction, settings.rpcUrl);
      this.#label = "";
      this.#address = "";
      engines.notifyChanged();
    } catch {
      this.#hasFailed = true;
    } finally {
      this.#isPending = false;
    }
  }
}
