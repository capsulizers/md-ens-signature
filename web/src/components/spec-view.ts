import { css, html, LitElement, type TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";

import "./markdown-view.ts";

declare global {
  interface HTMLElementTagNameMap {
    "md-spec-view": SpecViewElement;
  }
}

/** The repository's `docs/spec.md`, bundled into the page as text. */
const SPEC_SOURCES = import.meta.glob<string>("../../../docs/spec.md", {
  eager: true,
  import: "default",
  query: "?raw",
});

/** The MDTP specification's Markdown. */
const SPEC = Object.values(SPEC_SOURCES)[0] ?? "";

/** Shows the MDTP specification, rendered like a published document. */
@customElement("md-spec-view")
export class SpecViewElement extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }

    md-markdown-view {
      padding: var(--wa-space-xl);
      border: var(--wa-border-width-s) solid var(--wa-color-surface-border);
      border-radius: var(--wa-border-radius-l);
      background: var(--wa-color-surface-default);
    }
  `;

  override render(): TemplateResult {
    return html`
      <md-markdown-view .markdown=${SPEC}></md-markdown-view>
    `;
  }
}
