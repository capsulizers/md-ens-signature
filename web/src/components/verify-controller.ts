import type { ReactiveController, ReactiveControllerHost } from "lit";

import { VERIFY_DEBOUNCE_MS } from "#constants";
import type { Settings } from "#context";
import type { SignatureEngine, Verdict } from "#engine";

/**
 * Owns the debounce timer that re-verifies the file after an edit, and drops
 * any answer that arrives after a newer request was made.
 */
export class VerifyController implements ReactiveController {
  #timer: number | null = null;
  #request = 0;

  constructor(host: ReactiveControllerHost) {
    host.addController(this);
  }

  /** Verifies the file again once edits pause, reporting null meanwhile. */
  sync(
    engine: SignatureEngine,
    markdown: string,
    settings: Settings,
    onVerdict: (verdict: Verdict | null) => void,
  ): void {
    this.#cancel();
    onVerdict(null);
    const request = this.#request;
    this.#timer = setTimeout(async (): Promise<void> => {
      this.#timer = null;
      const verdict = await engine.verify(
        markdown,
        settings.rpcUrl,
        settings.parentName,
      );
      if (request === this.#request) {
        onVerdict(verdict);
      }
    }, VERIFY_DEBOUNCE_MS);
  }

  hostConnected(): void {}

  hostDisconnected(): void {
    this.#cancel();
  }

  #cancel(): void {
    this.#request += 1;
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
  }
}
