import DOMPurify from "dompurify";
import { css, html, LitElement, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Marked, type Token } from "marked";

import { TEXT } from "#constants";
import { isMdtpLink, isReadHash, readHash } from "#utils";

declare global {
  interface HTMLElementTagNameMap {
    "md-markdown-view": MarkdownViewElement;
  }
}

/** Frontmatter at the start of a file, and the body after it. */
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/**
 * Parses Markdown with `mdtp://` links turned into the Read tab's hash, so
 * the sanitizer keeps them and following one is ordinary page navigation.
 */
const MARKED = new Marked({
  walkTokens(token: Token): void {
    if (token.type === "link" && isMdtpLink(token.href)) {
      token.href = readHash(token.href);
    }
  },
});

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
    const yaml = match?.[1];
    const body = this.markdown.slice(match?.[0].length ?? 0);
    const rendered = renderMarkdown(body);
    const frontmatter = yaml === undefined ? html`` : html`
      <pre class="frontmatter" aria-label=${TEXT.frontmatterLabel}>${yaml}</pre>
    `;
    return html`
      ${frontmatter}
      <article @click=${this.#onClick}>${rendered}</article>
    `;
  }

  /**
   * Opens web links in a new tab, lets links to other published documents
   * move the Read tab, and keeps any other link from leaving the page.
   */
  #onClick(event: MouseEvent): void {
    const link = event.composedPath().find(
      (target: EventTarget): target is HTMLAnchorElement =>
        target instanceof HTMLAnchorElement,
    );
    const href = link?.getAttribute("href");
    if (href === null || href === undefined || isReadHash(href)) {
      return;
    }
    event.preventDefault();
    if (/^https?:/i.test(href)) {
      globalThis.open(href, "_blank", "noopener,noreferrer");
    }
  }
}

/** Markdown rendered to HTML, sanitized, and parsed into inert nodes. */
function renderMarkdown(markdown: string): DocumentFragment {
  const clean = DOMPurify.sanitize(MARKED.parse(markdown, { async: false }));
  const parsed = new DOMParser().parseFromString(clean, "text/html");
  const fragment = document.createDocumentFragment();
  fragment.append(...parsed.body.childNodes);
  return fragment;
}
