import "@awesome.me/webawesome/dist/components/badge/badge.js";
import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
import { css, html, LitElement, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";

import { ETHERSCAN_TX_URL, TEXT } from "#constants";
import type { Version } from "#engine";
import { utcTime } from "#utils";

declare global {
  interface HTMLElementTagNameMap {
    "md-version-list": VersionListElement;
  }

  interface HTMLElementEventMap {
    "version-select": CustomEvent<Version>;
  }
}

/**
 * A published document's versions, newest first, each with its time and
 * transaction. Choosing one fires `version-select` with it.
 */
@customElement("md-version-list")
export class VersionListElement extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--wa-space-2xs);
    }

    h2 {
      display: flex;
      align-items: center;
      gap: var(--wa-space-xs);
      margin: 0;
      font-size: var(--wa-font-size-m);
    }

    ol {
      display: flex;
      flex-direction: column;
      gap: var(--wa-space-3xs);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--wa-space-s);
    }

    .time {
      font-variant-numeric: tabular-nums;
    }

    a {
      min-width: 0;
      overflow: hidden;
      color: var(--wa-color-text-link);
      font-family: var(--wa-font-family-code);
      font-size: var(--wa-font-size-s);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .quiet {
      color: var(--wa-color-text-quiet);
      font-size: var(--wa-font-size-s);
    }
  `;

  /** The versions, newest first. */
  @property({ attribute: false })
  accessor versions: Version[] = [];

  /** The version shown now, which is not offered again. */
  @property({ attribute: false })
  accessor shown: Version | null = null;

  override render(): TemplateResult {
    const rows = this.versions.map((version: Version, index: number) =>
      this.#renderVersion(version, index === 0)
    );
    return html`
      <h2>
        <wa-icon name="clock-history"></wa-icon>
        ${TEXT.versionsTitle}
      </h2>
      <ol>${rows}</ol>
    `;
  }

  #renderVersion(version: Version, isCurrent: boolean): TemplateResult {
    const time = utcTime(version.timestamp);
    const isShown = version === this.shown;
    const current = isCurrent
      ? html`
        <wa-badge variant="brand" appearance="outlined">
          ${TEXT.versionCurrent}
        </wa-badge>
      `
      : html``;
    const hash = version.txHash ?? version.recordTxHash;
    const url = `${ETHERSCAN_TX_URL}${hash}`;
    const appearance = isShown ? "filled" : "plain";
    const variant = isShown ? "brand" : "neutral";
    const isMalformed = version.txHash === null;
    const onClick = (): void => this.#select(version);
    const malformed = isMalformed
      ? html`<span class="quiet">${TEXT.versionMalformed}</span>`
      : html``;
    return html`
      <li>
        <wa-button
          size="small"
          appearance=${appearance}
          variant=${variant}
          ?disabled=${isMalformed}
          @click=${onClick}
        >
          <span class="time">${time}</span>
        </wa-button>
        ${current} ${malformed}
        <a href=${url} target="_blank" rel="noopener noreferrer">${hash}</a>
      </li>
    `;
  }

  #select(version: Version): void {
    this.dispatchEvent(
      new CustomEvent<Version>("version-select", { detail: version }),
    );
  }
}
