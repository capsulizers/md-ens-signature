import "@awesome.me/webawesome/dist/components/badge/badge.js";
import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
import { consume } from "@lit/context";
import { css, html, LitElement, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";

import { ETHERSCAN_ADDRESS_URL, METAMASK_URL, TEXT } from "#constants";
import {
  EMPTY_WALLET_CONTEXT,
  type WalletContext,
  walletContext,
} from "#context";
import { WALLET_CHAIN } from "#engine";
import { shortAddress } from "#utils";

declare global {
  interface HTMLElementTagNameMap {
    "md-wallet-button": WalletButtonElement;
  }
}

/** Connects the browser wallet and keeps it on Sepolia. */
@customElement("md-wallet-button")
export class WalletButtonElement extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: end;
      gap: var(--wa-space-2xs);
    }

    .row {
      display: flex;
      flex-wrap: wrap;
      justify-content: end;
      align-items: center;
      gap: var(--wa-space-s);
    }

    .hint {
      max-width: 22rem;
      color: var(--wa-color-text-quiet);
      font-size: var(--wa-font-size-s);
      text-align: end;
    }

    .error {
      color: var(--wa-color-danger-on-quiet);
      font-size: var(--wa-font-size-s);
    }

    a {
      color: var(--wa-color-text-link);
    }

    .address {
      font-family: var(--wa-font-family-code);
    }
  `;

  @consume({ context: walletContext, subscribe: true })
  accessor #wallet: WalletContext = EMPTY_WALLET_CONTEXT;

  @state()
  accessor #isBusy: boolean = false;

  @state()
  accessor #hasFailed: boolean = false;

  override render(): TemplateResult {
    const error = this.#hasFailed
      ? html`
        <div class="error" role="alert">${TEXT.walletFailed}</div>
      `
      : html``;
    const row = this.#renderRow();
    return html`
      ${row} ${error}
    `;
  }

  #renderRow(): TemplateResult {
    const wallet = this.#wallet;
    if (!wallet.isAvailable) {
      return html`
        <div class="hint">
          ${TEXT.noWallet}
          <a href=${METAMASK_URL} target="_blank" rel="noopener noreferrer">
            ${TEXT.getMetaMask}
          </a>
        </div>
      `;
    }
    const account = wallet.state.account;
    if (account === null) {
      return html`
        <wa-button
          variant="brand"
          ?loading=${this.#isBusy}
          @click=${this.#connect}
        >
          <wa-icon slot="start" name="wallet2"></wa-icon>
          ${TEXT.connectWallet}
        </wa-button>
      `;
    }
    const url = `${ETHERSCAN_ADDRESS_URL}${account}`;
    const short = shortAddress(account);
    const chain = wallet.state.chainId === WALLET_CHAIN.id
      ? html`
        <wa-badge variant="success" pill>${WALLET_CHAIN.name}</wa-badge>
      `
      : html`
        <wa-button
          size="s"
          variant="warning"
          ?loading=${this.#isBusy}
          @click=${this.#switchChain}
        >
          ${TEXT.switchToSepolia}
        </wa-button>
      `;
    return html`
      <div class="row">
        ${chain}
        <a
          class="address"
          href=${url}
          target="_blank"
          rel="noopener noreferrer"
        >
          ${short}
        </a>
      </div>
    `;
  }

  #connect(): void {
    void this.#run(this.#wallet.connect);
  }

  #switchChain(): void {
    void this.#run(this.#wallet.switchChain);
  }

  async #run(action: () => Promise<void>): Promise<void> {
    this.#isBusy = true;
    this.#hasFailed = false;
    try {
      await action();
    } catch {
      this.#hasFailed = true;
    } finally {
      this.#isBusy = false;
    }
  }
}
