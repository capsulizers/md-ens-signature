import "@awesome.me/webawesome/dist/components/badge/badge.js";
import { css, html, LitElement, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";

import { ETHERSCAN_ADDRESS_URL, TEXT } from "#constants";
import type { Member } from "#engine";
import { shortAddress } from "#utils";

declare global {
  interface HTMLElementTagNameMap {
    "md-member-row": MemberRowElement;
  }
}

/** One member with its owner and whether it may sign now. */
@customElement("md-member-row")
export class MemberRowElement extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: var(--wa-space-s);
      padding: var(--wa-space-s) 0;
    }

    .who {
      display: flex;
      flex: 1;
      flex-direction: column;
      align-items: start;
      gap: var(--wa-space-2xs);
      min-width: 0;
    }

    .name {
      overflow-wrap: anywhere;
      font-weight: var(--wa-font-weight-semibold);
    }

    .owner {
      color: var(--wa-color-text-quiet);
      font-size: var(--wa-font-size-s);
    }

    a {
      color: var(--wa-color-text-link);
      font-family: var(--wa-font-family-code);
    }
  `;

  /** The member as the chain reports it. */
  @property({ attribute: false })
  accessor member: Member | null = null;

  override render(): TemplateResult {
    const member = this.member;
    if (member === null) {
      return html``;
    }
    const owner = this.#owner(member);
    const chip = member.status === "GRANTED"
      ? html`
        <wa-badge variant="success" pill>${TEXT.granted}</wa-badge>
      `
      : html`
        <wa-badge variant="danger" pill>${TEXT.revoked}</wa-badge>
      `;
    return html`
      <div class="who">
        <span class="name">${member.name}</span>
        ${owner}
      </div>
      ${chip}
    `;
  }

  #owner(member: Member): TemplateResult {
    if (member.owner === null) {
      return html`
        <span class="owner">${TEXT.noOwner}</span>
      `;
    }
    const url = `${ETHERSCAN_ADDRESS_URL}${member.owner}`;
    const short = shortAddress(member.owner);
    return html`
      <span class="owner">
        ${TEXT.ownedBy}
        <a href=${url} target="_blank" rel="noopener noreferrer">${short}</a>
      </span>
    `;
  }
}
