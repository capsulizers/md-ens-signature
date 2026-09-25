import "@awesome.me/webawesome/dist/components/icon/icon.js";
import { css, html, LitElement, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";

import { TEXT } from "#constants";
import type { Verdict } from "#engine";

declare global {
  interface HTMLElementTagNameMap {
    "md-verdict-badge": VerdictBadgeElement;
  }
}

/** How a verdict is drawn: its tone, icon, title, and detail line. */
interface BadgeLook {
  tone: string;
  icon: string;
  title: string;
  detail: string;
}

/** Shows what verifying the file concluded, large enough to read at once. */
@customElement("md-verdict-badge")
export class VerdictBadgeElement extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }

    .badge {
      display: flex;
      align-items: center;
      gap: var(--wa-space-l);
      padding: var(--wa-space-l) var(--wa-space-xl);
      border: var(--wa-border-width-m) solid var(--border);
      border-radius: var(--wa-border-radius-l);
      background: var(--fill);
      color: var(--text);
    }

    .success {
      --border: var(--wa-color-success-border-loud);
      --fill: var(--wa-color-success-fill-quiet);
      --text: var(--wa-color-success-on-quiet);
    }

    .danger {
      --border: var(--wa-color-danger-border-loud);
      --fill: var(--wa-color-danger-fill-quiet);
      --text: var(--wa-color-danger-on-quiet);
    }

    .warning {
      --border: var(--wa-color-warning-border-loud);
      --fill: var(--wa-color-warning-fill-quiet);
      --text: var(--wa-color-warning-on-quiet);
    }

    .neutral {
      --border: var(--wa-color-neutral-border-normal);
      --fill: var(--wa-color-neutral-fill-quiet);
      --text: var(--wa-color-neutral-on-quiet);
    }

    wa-icon {
      flex: none;
      font-size: 2.5rem;
    }

    .title {
      font-size: var(--wa-font-size-2xl);
      font-weight: var(--wa-font-weight-bold);
      line-height: var(--wa-line-height-condensed);
    }

    .detail {
      margin-top: var(--wa-space-2xs);
      overflow-wrap: anywhere;
    }
  `;

  /** The verdict to show, or null while one is being worked out. */
  @property({ attribute: false })
  accessor verdict: Verdict | null = null;

  override render(): TemplateResult {
    const look = this.#look();
    return html`
      <div class="badge ${look.tone}" role="status">
        <wa-icon name=${look.icon}></wa-icon>
        <div>
          <div class="title">${look.title}</div>
          <div class="detail">${look.detail}</div>
        </div>
      </div>
    `;
  }

  #look(): BadgeLook {
    const verdict = this.verdict;
    switch (verdict?.kind) {
      case undefined:
        return {
          tone: "neutral",
          icon: "hourglass-split",
          title: TEXT.checking,
          detail: TEXT.checkingDetail,
        };
      case "verified":
        return {
          tone: "success",
          icon: "patch-check-fill",
          title: TEXT.verified,
          detail: TEXT.verifiedDetail(verdict.signer),
        };
      case "tampered":
        return {
          tone: "danger",
          icon: "x-octagon-fill",
          title: TEXT.tampered,
          detail: TEXT.tamperedDetail(verdict.signer),
        };
      case "unauthorized":
        return {
          tone: "warning",
          icon: "shield-exclamation",
          title: TEXT.unauthorized,
          detail: TEXT.unauthorizedDetail(verdict.signer),
        };
      case "unsigned":
        return {
          tone: "neutral",
          icon: "file-earmark",
          title: TEXT.unsigned,
          detail: TEXT.unsignedDetail,
        };
    }
  }
}
