import { provide } from "@lit/context";
import { css, html, LitElement, type TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";

import { TEXT } from "#constants";
import {
  EMPTY_SETTINGS_CONTEXT,
  type Settings,
  type SettingsContext,
  settingsContext,
  type SettingsPatch,
} from "#context";

import "./settings-row.ts";

declare global {
  interface HTMLElementTagNameMap {
    "md-root": RootElement;
  }
}

/** The whole page, and the owner of its settings. */
@customElement("md-root")
export class RootElement extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--wa-space-xl);
      max-width: 72rem;
      margin: 0 auto;
      padding: var(--wa-space-2xl) var(--wa-space-l);
    }

    h1 {
      margin: 0;
      font-size: var(--wa-font-size-2xl);
    }

    p {
      margin: var(--wa-space-xs) 0 0;
      color: var(--wa-color-text-quiet);
    }
  `;

  @provide({ context: settingsContext })
  accessor #settings: SettingsContext = this.#buildSettings(
    EMPTY_SETTINGS_CONTEXT.settings,
  );

  override render(): TemplateResult {
    return html`
      <header>
        <h1>${TEXT.title}</h1>
        <p>${TEXT.subtitle}</p>
      </header>
      <md-settings-row></md-settings-row>
    `;
  }

  #buildSettings(settings: Settings): SettingsContext {
    return {
      settings,
      updateSettings: (patch: SettingsPatch): void => {
        this.#settings = this.#buildSettings({ ...settings, ...patch });
      },
    };
  }
}
