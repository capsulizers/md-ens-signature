import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
import WaInput from "@awesome.me/webawesome/dist/components/input/input.js";
import { consume } from "@lit/context";
import { css, html, LitElement, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";

import { TEXT } from "#constants";
import {
  EMPTY_ENGINES,
  EMPTY_SETTINGS_CONTEXT,
  EMPTY_WALLET_CONTEXT,
  type Engines,
  enginesContext,
  type SettingsContext,
  settingsContext,
  type WalletContext,
  walletContext,
} from "#context";
import {
  TEAM_STEPS,
  type TeamStep,
  type TeamStepState,
  WALLET_CHAIN,
} from "#engine";

import "./transaction-note.ts";

declare global {
  interface HTMLElementTagNameMap {
    "md-team-wizard": TeamWizardElement;
  }
}

/** What checking the typed label found. */
type Availability = "UNKNOWN" | "CHECKING" | "AVAILABLE" | "TAKEN" | "FAILED";

/**
 * Walks a judge through registering their own team name on Sepolia, one
 * transaction at a time, then makes it the page's parent name.
 */
@customElement("md-team-wizard")
export class TeamWizardElement extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--wa-space-s);
      padding: var(--wa-space-l);
      border: var(--wa-border-width-s) solid var(--wa-color-surface-border);
      border-radius: var(--wa-border-radius-l);
      background: var(--wa-color-surface-default);
    }

    h2 {
      margin: 0;
      font-size: var(--wa-font-size-l);
    }

    .quiet,
    .hint {
      color: var(--wa-color-text-quiet);
      font-size: var(--wa-font-size-s);
    }

    .row {
      display: flex;
      align-items: end;
      gap: var(--wa-space-s);
    }

    .row wa-input {
      flex: 1;
    }

    .good {
      color: var(--wa-color-success-on-quiet);
      font-size: var(--wa-font-size-s);
    }

    .error {
      color: var(--wa-color-danger-on-quiet);
      font-size: var(--wa-font-size-s);
    }

    ol {
      display: flex;
      flex-direction: column;
      gap: var(--wa-space-xs);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    li {
      display: flex;
      flex-direction: column;
      gap: var(--wa-space-3xs);
    }

    .step {
      display: flex;
      align-items: center;
      gap: var(--wa-space-xs);
    }

    .step wa-icon {
      flex: none;
      font-size: var(--wa-font-size-s);
    }

    .done wa-icon {
      color: var(--wa-color-success-on-quiet);
    }

    .idle {
      color: var(--wa-color-text-quiet);
    }

    li md-transaction-note {
      padding-inline-start: var(--wa-space-l);
    }
  `;

  @consume({ context: enginesContext, subscribe: true })
  accessor #engines: Engines = EMPTY_ENGINES;

  @consume({ context: settingsContext, subscribe: true })
  accessor #settings: SettingsContext = EMPTY_SETTINGS_CONTEXT;

  @consume({ context: walletContext, subscribe: true })
  accessor #wallet: WalletContext = EMPTY_WALLET_CONTEXT;

  @state()
  accessor #label: string = "";

  @state()
  accessor #availability: Availability = "UNKNOWN";

  @state()
  accessor #steps: Map<TeamStep, TeamStepState> = new Map();

  @state()
  accessor #isRunning: boolean = false;

  @state()
  accessor #hasFailed: boolean = false;

  /** The name the last run registered, or null before one finishes. */
  @state()
  accessor #created: string | null = null;

  override render(): TemplateResult {
    const isLabelValid = this.#label !== "" && !this.#label.includes(".");
    const isCheckDisabled = !isLabelValid || this.#isRunning;
    const isChecking = this.#availability === "CHECKING";
    const hint = this.#hint();
    const isCreateDisabled = hint !== null || this.#isRunning ||
      this.#availability !== "AVAILABLE";
    const hintLine = hint === null ? html`` : html`
      <div class="hint">${hint}</div>
    `;
    const availability = this.#renderAvailability();
    const steps = this.#renderSteps();
    const outcome = this.#renderOutcome();
    return html`
      <div>
        <h2>${TEXT.teamTitle}</h2>
        <div class="quiet">${TEXT.teamSubtitle}</div>
      </div>
      <div class="row">
        <wa-input
          size="s"
          label=${TEXT.teamLabel}
          placeholder=${TEXT.teamLabelPlaceholder}
          ?disabled=${this.#isRunning}
          .value=${this.#label}
          @input=${this.#onLabelInput}
        >
          <span slot="end">.eth</span>
        </wa-input>
        <wa-button
          size="s"
          appearance="outlined"
          ?disabled=${isCheckDisabled}
          ?loading=${isChecking}
          @click=${this.#check}
        >
          ${TEXT.teamCheck}
        </wa-button>
      </div>
      ${availability}
      <wa-button
        variant="brand"
        ?disabled=${isCreateDisabled}
        ?loading=${this.#isRunning}
        @click=${this.#create}
      >
        <wa-icon slot="start" name="stars"></wa-icon>
        ${TEXT.teamCreate}
      </wa-button>
      ${hintLine} ${steps} ${outcome}
    `;
  }

  /** Why the wallet cannot create a name, or null when it can. */
  #hint(): string | null {
    const wallet = this.#wallet;
    if (!wallet.isAvailable || wallet.state.account === null) {
      return TEXT.teamConnect;
    }
    if (wallet.state.chainId !== WALLET_CHAIN.id) {
      return TEXT.switchToManage;
    }
    return null;
  }

  #renderAvailability(): TemplateResult {
    const name = `${this.#label}.eth`;
    switch (this.#availability) {
      case "AVAILABLE": {
        const text = TEXT.teamAvailable(name);
        return html`
          <div class="good">${text}</div>
        `;
      }
      case "TAKEN": {
        const text = TEXT.teamTaken(name);
        return html`
          <div class="error">${text}</div>
        `;
      }
      case "FAILED":
        return html`
          <div class="error" role="alert">${TEXT.teamCheckFailed}</div>
        `;
      case "UNKNOWN":
      case "CHECKING":
        return html``;
    }
  }

  #renderSteps(): TemplateResult {
    if (this.#steps.size === 0) {
      return html``;
    }
    const items = TEAM_STEPS.map((step: TeamStep): TemplateResult =>
      this.#renderStep(step)
    );
    return html`
      <ol>${items}</ol>
    `;
  }

  #renderStep(step: TeamStep): TemplateResult {
    const stepState = this.#steps.get(step) ?? null;
    const title = stepTitle(step);
    const seconds = stepState?.secondsLeft ?? null;
    const detail = this.#renderSeconds(
      stepState?.isDone === true ? null : seconds,
    );
    const note = this.#renderNote(step, stepState);
    const icon = this.#stepIcon(stepState);
    const stepClass = stepState === null ? "step idle" : "step";
    return html`
      <li>
        <div class=${stepClass}>${icon} ${title} ${detail}</div>
        ${note}
      </li>
    `;
  }

  #renderSeconds(seconds: number | null): TemplateResult {
    if (seconds === null) {
      return html``;
    }
    const text = TEXT.teamWaitSeconds(seconds);
    return html`
      <span class="quiet">${text}</span>
    `;
  }

  #renderNote(step: TeamStep, stepState: TeamStepState | null): TemplateResult {
    if (stepState === null || step === "WAIT") {
      return html``;
    }
    const isPending = !stepState.isDone && this.#isRunning;
    return html`
      <md-transaction-note
        .transaction=${stepState.transaction}
        .isPending=${isPending}
      ></md-transaction-note>
    `;
  }

  #stepIcon(stepState: TeamStepState | null): TemplateResult {
    if (stepState === null) {
      return html`
        <wa-icon name="circle"></wa-icon>
      `;
    }
    if (stepState.isDone) {
      return html`
        <span class="done"><wa-icon name="check-circle-fill"></wa-icon></span>
      `;
    }
    return html`
      <wa-icon name="hourglass-split"></wa-icon>
    `;
  }

  #renderOutcome(): TemplateResult {
    if (this.#hasFailed) {
      return html`
        <div class="error" role="alert">${TEXT.teamFailed}</div>
      `;
    }
    if (this.#created !== null) {
      const text = TEXT.teamCreated(this.#created);
      return html`
        <div class="good">${text}</div>
      `;
    }
    return html``;
  }

  #onLabelInput(event: Event): void {
    const input = event.currentTarget;
    if (input instanceof WaInput) {
      this.#label = (input.value ?? "").trim().toLowerCase();
      this.#availability = "UNKNOWN";
    }
  }

  async #check(): Promise<void> {
    const label = this.#label;
    this.#availability = "CHECKING";
    try {
      const isAvailable = await this.#engines.team.isAvailable(
        label,
        this.#settings.settings.rpcUrl,
      );
      if (label === this.#label) {
        this.#availability = isAvailable ? "AVAILABLE" : "TAKEN";
      }
    } catch {
      if (label === this.#label) {
        this.#availability = "FAILED";
      }
    }
  }

  /** Runs every step, then points the page at the new name. */
  async #create(): Promise<void> {
    const label = this.#label;
    const settings = this.#settings;
    this.#isRunning = true;
    this.#hasFailed = false;
    this.#created = null;
    this.#steps = new Map();
    try {
      await this.#engines.team.create(
        label,
        settings.settings.rpcUrl,
        (step: TeamStep, stepState: TeamStepState): void => {
          this.#steps = new Map(this.#steps).set(step, stepState);
        },
      );
      this.#created = `${label}.eth`;
      this.#availability = "UNKNOWN";
      settings.updateSettings({ parentName: this.#created });
    } catch {
      this.#hasFailed = true;
    } finally {
      this.#isRunning = false;
    }
  }
}

/** The title a step is shown with. */
function stepTitle(step: TeamStep): string {
  const titles = TEXT.teamSteps;
  switch (step) {
    case "DEPLOY_REGISTRY":
      return titles.deployRegistry;
    case "DEPLOY_RESOLVER":
      return titles.deployResolver;
    case "MINT":
      return titles.mint;
    case "APPROVE":
      return titles.approve;
    case "COMMIT":
      return titles.commit;
    case "WAIT":
      return titles.wait;
    case "REGISTER":
      return titles.register;
    case "SET_ADDRESS":
      return titles.setAddress;
  }
}
