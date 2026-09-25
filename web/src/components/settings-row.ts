import WaInput from "@awesome.me/webawesome/dist/components/input/input.js";
import { consume } from "@lit/context";
import { css, html, LitElement, type TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";

import { TEXT } from "#constants";
import {
  EMPTY_SETTINGS_CONTEXT,
  type SettingsContext,
  settingsContext,
} from "#context";

declare global {
  interface HTMLElementTagNameMap {
    "md-settings-row": SettingsRowElement;
  }
}

/** Edits the RPC endpoint and the parent ENS name. */
@customElement("md-settings-row")
export class SettingsRowElement extends LitElement {
  static override styles = css`
    :host {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: var(--wa-space-m);
    }

    @media (max-width: 40rem) {
      :host {
        grid-template-columns: 1fr;
      }
    }
  `;

  @consume({ context: settingsContext, subscribe: true })
  accessor #settings: SettingsContext = EMPTY_SETTINGS_CONTEXT;

  override render(): TemplateResult {
    const settings = this.#settings.settings;
    return html`
      <wa-input
        label=${TEXT.rpcUrlLabel}
        type="url"
        .value=${settings.rpcUrl}
        @change=${this.#onRpcUrlChange}
      ></wa-input>
      <wa-input
        label=${TEXT.parentNameLabel}
        hint=${TEXT.parentNameHint}
        .value=${settings.parentName}
        @change=${this.#onParentNameChange}
      ></wa-input>
    `;
  }

  #onRpcUrlChange(event: Event): void {
    const rpcUrl = inputValue(event);
    if (rpcUrl !== null) {
      this.#settings.updateSettings({ rpcUrl });
    }
  }

  #onParentNameChange(event: Event): void {
    const parentName = inputValue(event)?.toLowerCase() ?? null;
    if (parentName !== null) {
      this.#settings.updateSettings({ parentName });
    }
  }
}

/** The trimmed value of the input an event came from, or null when empty. */
function inputValue(event: Event): string | null {
  const input = event.currentTarget;
  if (!(input instanceof WaInput)) {
    return null;
  }
  const value = (input.value ?? "").trim();
  return value === "" ? null : value;
}
