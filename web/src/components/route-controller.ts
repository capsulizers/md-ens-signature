import type { ReactiveController, ReactiveControllerHost } from "lit";

import { parseRoute, type Route } from "#utils";

/**
 * Owns the subscription to the location hash, so following a link between
 * published documents and the browser's back and forward buttons move the
 * page.
 */
export class RouteController implements ReactiveController {
  #onChange: (route: Route) => void = (): void => {};

  constructor(host: ReactiveControllerHost) {
    host.addController(this);
  }

  /** Sets who hears about the route from now on. */
  listen(onChange: (route: Route) => void): void {
    this.#onChange = onChange;
  }

  hostConnected(): void {
    globalThis.addEventListener("hashchange", this.#refresh);
    this.#refresh();
  }

  hostDisconnected(): void {
    globalThis.removeEventListener("hashchange", this.#refresh);
  }

  #refresh = (): void => {
    this.#onChange(parseRoute(globalThis.location.hash));
  };
}
