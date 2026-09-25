import { css, html, LitElement, type TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";

import { TEXT } from "#constants";

declare global {
  interface HTMLElementTagNameMap {
    "md-root": RootElement;
  }
}

@customElement("md-root")
export class RootElement extends LitElement {
  static override styles = css`
    :host {
      display: block;
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

  override render(): TemplateResult {
    return html`
      <header>
        <h1>${TEXT.title}</h1>
        <p>${TEXT.subtitle}</p>
      </header>
    `;
  }
}
