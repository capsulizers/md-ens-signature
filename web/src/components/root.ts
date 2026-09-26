import "@awesome.me/webawesome/dist/components/tab-group/tab-group.js";
import "@awesome.me/webawesome/dist/components/tab-panel/tab-panel.js";
import "@awesome.me/webawesome/dist/components/tab/tab.js";
import type { WaTabShowEvent } from "@awesome.me/webawesome/dist/events/tab-show.js";
import { provide } from "@lit/context";
import { css, html, LitElement, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";

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
  type WalletContext,
  walletContext,
} from "#context";
import { hasWallet, switchToSepolia, type WalletState } from "#engine";
import { isTab, parseRoute, type Route, routeHash } from "#utils";

import "./document-panel.ts";
import "./permissions-panel.ts";
import "./publish-view.ts";
import "./read-view.ts";
import { RouteController } from "./route-controller.ts";
import "./settings-row.ts";
import "./spec-view.ts";
import "./team-wizard.ts";
import "./wallet-button.ts";
import { WalletController } from "./wallet-controller.ts";

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

    .side {
      display: flex;
      flex-direction: column;
      gap: var(--wa-space-xl);
    }

    @media (max-width: 60rem) {
      .panels {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: start;
      gap: var(--wa-space-m);
    }

    h1 {
      margin: 0;
      font-size: var(--wa-font-size-2xl);
    }

    .story {
      margin: var(--wa-space-xs) 0 0;
      font-size: var(--wa-font-size-l);
      font-weight: var(--wa-font-weight-semibold);
    }

    p {
      max-width: 44rem;
      margin: var(--wa-space-xs) 0 0;
      color: var(--wa-color-text-quiet);
    }

    wa-tab-panel::part(base) {
      padding: var(--wa-space-xl) 0 0;
    }
  `;

  @provide({ context: enginesContext })
  accessor #engines: Engines = createEngines((): void => {
    this.#engines = { ...this.#engines, revision: this.#engines.revision + 1 };
  });

  #walletController = new WalletController(this);

  #routeController = new RouteController(this);

  @state()
  accessor #route: Route = this.#listenToRoute();

  @provide({ context: walletContext })
  accessor #wallet: WalletContext = this.#listenToWallet();

  @provide({ context: settingsContext })
  accessor #settings: SettingsContext = this.#buildSettings(
    EMPTY_SETTINGS_CONTEXT.settings,
  );

  override render(): TemplateResult {
    return html`
      <header>
        <div>
          <h1>${TEXT.title}</h1>
          <div class="story">${TEXT.story}</div>
          <p>${TEXT.subtitle}</p>
        </div>
        <md-wallet-button></md-wallet-button>
      </header>
      <md-settings-row></md-settings-row>
      <wa-tab-group active=${this.#route.tab} @wa-tab-show=${this.#onTabShow}>
        <wa-tab panel="SIGN">${TEXT.signTab}</wa-tab>
        <wa-tab panel="PUBLISH">${TEXT.publishTab}</wa-tab>
        <wa-tab panel="READ">${TEXT.readTab}</wa-tab>
        <wa-tab panel="SPEC">${TEXT.specTab}</wa-tab>
        <wa-tab-panel name="SIGN">
          <div class="panels">
            <md-document-panel></md-document-panel>
            <div class="side">
              <md-permissions-panel></md-permissions-panel>
              <md-team-wizard></md-team-wizard>
            </div>
          </div>
        </wa-tab-panel>
        <wa-tab-panel name="PUBLISH">
          <md-publish-view></md-publish-view>
        </wa-tab-panel>
        <wa-tab-panel name="READ">
          <md-read-view .name=${this.#route.name}></md-read-view>
        </wa-tab-panel>
        <wa-tab-panel name="SPEC">
          <md-spec-view></md-spec-view>
        </wa-tab-panel>
      </wa-tab-group>
    `;
  }

  /** Follows the location hash, starting from the one the page opened at. */
  #listenToRoute(): Route {
    this.#routeController.listen((route: Route): void => {
      this.#route = route;
    });
    return parseRoute(globalThis.location.hash);
  }

  /**
   * Records a tab picked by hand in the hash without a history entry, so the
   * link can be shared while back and forward still step between documents.
   */
  #onTabShow(event: WaTabShowEvent): void {
    const tab = event.detail.name;
    if (!isTab(tab) || tab === this.#route.tab) {
      return;
    }
    this.#route = { ...this.#route, tab };
    globalThis.history.replaceState(null, "", routeHash(this.#route));
  }

  /** Rebuilds the wallet context on every change, starting disconnected. */
  #listenToWallet(): WalletContext {
    this.#walletController.listen((state: WalletState): void => {
      this.#wallet = this.#buildWallet(state);
    });
    return this.#buildWallet({ account: null, chainId: null });
  }

  #buildWallet(state: WalletState): WalletContext {
    return {
      isAvailable: hasWallet(),
      state,
      connect: (): Promise<void> => this.#walletController.connect(),
      switchChain: switchToSepolia,
    };
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
