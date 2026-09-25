import type { ReactiveController, ReactiveControllerHost } from "lit";
import type { EIP1193Provider } from "viem";

import {
  connectWallet,
  injectedWallet,
  readWallet,
  type WalletState,
} from "#engine";

/**
 * Owns the subscription to the browser wallet's account and chain events,
 * reading the wallet again whenever either changes.
 */
export class WalletController implements ReactiveController {
  #onChange: (state: WalletState) => void = (): void => {};
  #wallet: EIP1193Provider | null = null;

  constructor(host: ReactiveControllerHost) {
    host.addController(this);
  }

  /** Sets who hears about the wallet's state from now on. */
  listen(onChange: (state: WalletState) => void): void {
    this.#onChange = onChange;
  }

  hostConnected(): void {
    this.#wallet = injectedWallet();
    this.#wallet?.on("accountsChanged", this.#refresh);
    this.#wallet?.on("chainChanged", this.#refresh);
    this.#refresh();
  }

  hostDisconnected(): void {
    this.#wallet?.removeListener("accountsChanged", this.#refresh);
    this.#wallet?.removeListener("chainChanged", this.#refresh);
    this.#wallet = null;
  }

  /** Asks the user to connect an account and reports the result. */
  async connect(): Promise<void> {
    this.#onChange(await connectWallet());
  }

  #refresh = (): void => {
    if (this.#wallet === null) {
      return;
    }
    readWallet().then(
      (state: WalletState): void => this.#onChange(state),
      (): void => {},
    );
  };
}
