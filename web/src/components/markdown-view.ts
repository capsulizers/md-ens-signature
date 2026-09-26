import DOMPurify from "dompurify";
import { css, html, LitElement, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { marked } from "marked";

import { TEXT } from "#constants";
import { documentName, isMdtpLink, routeHash } from "#utils";

declare global {
  interface HTMLElementTagNameMap {
    "md-markdown-view": MarkdownViewElement;
  }
}

/**
 * The link schemes a published file may use: the web, mail, and `mdtp://`
 * links to other published documents. Anything else, such as `javascript:`,
 * is dropped by the sanitizer.
 */
const ALLOWED_URI =
  /^(?:(?:https?|mailto|mdtp):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

/** Frontmatter at the start of a file, and the body after it. */
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/**
 * Renders a published Markdown file as sanitized HTML, and follows its
 * `mdtp://` links inside the page so back and forward step between them.
 */
@customElement("md-markdown-view")
export class MarkdownViewElement extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--wa-space-m);
      line-height: var(--wa-line-height-normal);
      overflow-wrap: anywhere;
    }

    .frontmatter {
      margin: 0;
      padding: var(--wa-space-s) var(--wa-space-m);
      border-radius: var(--wa-border-radius-m);
      background: var(--wa-color-surface-lowered);
      color: var(--wa-color-text-quiet);
      font-family: var(--wa-font-family-code);
      font-size: var(--wa-font-size-s);
      white-space: pre-wrap;
    }

    article > :first-child {
      margin-top: 0;
    }

    article > :last-child {
      margin-bottom: 0;
    }

    a {
      color: var(--wa-color-text-link);
    }

    code {
      font-family: var(--wa-font-family-code);
      font-size: 0.9em;
    }

    pre {
      overflow-x: auto;
      padding: var(--wa-space-s) var(--wa-space-m);
      border-radius: var(--wa-border-radius-m);
      background: var(--wa-color-surface-lowered);
    }

    table {
      border-collapse: collapse;
    }

    th,
    td {
      padding: var(--wa-space-2xs) var(--wa-space-s);
      border: var(--wa-border-width-s) solid var(--wa-color-surface-border);
      text-align: start;
    }

    blockquote {
      margin-inline: 0;
      padding-inline-start: var(--wa-space-m);
      border-inline-start: var(--wa-border-width-l) solid
        var(--wa-color-surface-border);
      color: var(--wa-color-text-quiet);
    }
  `;

  /** The Markdown file to show, frontmatter and all. */
  @property({ attribute: false })
  accessor markdown: string = "";

  override render(): TemplateResult {
    const match = FRONTMATTER.exec(this.markdown);
    const body = match === null
      ? this.markdown
      : this.markdown.slice(match[0].length);
    const rendered = DOMPurify.sanitize(
      marked.parse(body, { async: false }),
      { ALLOWED_URI_REGEXP: ALLOWED_URI },
    );
    const frontmatter = match?.[1] === undefined ? html`` : html`
      <pre class="frontmatter" aria-label=${TEXT
        .frontmatterLabel}>${match[1]}</pre>
    `;
    return html`
      ${frontmatter}
      <article @click=${this.#onClick}>${unsafeHTML(rendered)}</article>
    `;
  }

  /**
   * Opens `mdtp://` links in the Read tab and web links in a new tab, and
   * keeps any other link from moving the page away.
   */
  #onClick(event: MouseEvent): void {
    const link = event.composedPath().find(
      (target: EventTarget): target is HTMLAnchorElement =>
        target instanceof HTMLAnchorElement,
    );
    const href = link?.getAttribute("href");
    if (href === null || href === undefined) {
      return;
    }
    event.preventDefault();
    if (isMdtpLink(href)) {
      const name = documentName(href);
      globalThis.location.hash = routeHash({ tab: "read", name });
    } else if (/^https?:/i.test(href)) {
      globalThis.open(href, "_blank", "noopener,noreferrer");
    }
  }
}
