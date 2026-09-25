import { consume } from "@lit/context";
import { css, html, LitElement, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";

import {
  EMPTY_ENGINES,
  EMPTY_SETTINGS_CONTEXT,
  type Engines,
  enginesContext,
  type SettingsContext,
  settingsContext,
} from "#context";
import type { Verdict } from "#engine";
import { syncAfterSet } from "#utils";

import "./file-area.ts";
import "./verdict-badge.ts";
import { VerifyController } from "./verify-controller.ts";

declare global {
  interface HTMLElementTagNameMap {
    "md-document-panel": DocumentPanelElement;
  }
}

/** Owns the open Markdown file and keeps its verdict current. */
@customElement("md-document-panel")
export class DocumentPanelElement extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--wa-space-l);
    }
  `;

  #verifyController = new VerifyController(this);

  @consume({ context: enginesContext, subscribe: true })
  @syncAfterSet((host: DocumentPanelElement): void => host.#verify())
  accessor #engines: Engines = EMPTY_ENGINES;

  @consume({ context: settingsContext, subscribe: true })
  @syncAfterSet((host: DocumentPanelElement): void => host.#verify())
  accessor #settings: SettingsContext = EMPTY_SETTINGS_CONTEXT;

  @state()
  accessor #markdown: string = "";

  @state()
  accessor #verdict: Verdict | null = null;

  override render(): TemplateResult {
    return html`
      <md-verdict-badge .verdict=${this.#verdict}></md-verdict-badge>
      <md-file-area
        .markdown=${this.#markdown}
        @markdown-change=${this.#onMarkdownChange}
      ></md-file-area>
    `;
  }

  #onMarkdownChange(event: CustomEvent<string>): void {
    this.#markdown = event.detail;
    this.#verify();
  }

  #verify(): void {
    this.#verifyController.sync(
      this.#engines.signature,
      this.#markdown,
      this.#settings.settings,
      (verdict: Verdict | null): void => {
        this.#verdict = verdict;
      },
    );
  }
}
