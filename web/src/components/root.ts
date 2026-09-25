import { provide } from "@lit/context";
import { css, html, LitElement, type TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";

import { TEXT } from "#constants";
import {
  createEngines,
  EMPTY_SETTINGS_CONTEXT,
  type Engines,
  enginesContext,
  type Settings,
  type SettingsContext,
  settingsContext,
  type SettingsPatch,
} from "#context";

import "./document-panel.ts";
import "./permissions-panel.ts";
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

    .panels {
      display: grid;
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
      align-items: start;
      gap: var(--wa-space-xl);
    }

    @media (max-width: 60rem) {
      .panels {
        grid-template-columns: minmax(0, 1fr);
      }
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

  @provide({ context: enginesContext })
  accessor #engines: Engines = createEngines((): void => {
    this.#engines = { ...this.#engines, revision: this.#engines.revision + 1 };
  });

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
      <div class="panels">
        <md-document-panel></md-document-panel>
        <md-permissions-panel></md-permissions-panel>
      </div>
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
