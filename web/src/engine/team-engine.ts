import type { Transaction } from "./permissions-engine.ts";

/** One step of registering a team name. */
export type TeamStep =
  | "DEPLOY_REGISTRY"
  | "DEPLOY_RESOLVER"
  | "MINT"
  | "APPROVE"
  | "COMMIT"
  | "WAIT"
  | "REGISTER"
  | "SET_ADDRESS";

/** The steps that register a team name, in the order they run. */
export const TEAM_STEPS: TeamStep[] = [
  "DEPLOY_REGISTRY",
  "DEPLOY_RESOLVER",
  "MINT",
  "APPROVE",
  "COMMIT",
  "WAIT",
  "REGISTER",
  "SET_ADDRESS",
];

/** Where one step stands. */
export interface TeamStepState {
  /** The step's transaction once the wallet has sent it. */
  transaction: Transaction | null;
  /** Whether the step has finished. */
  isDone: boolean;
  /** For the wait, the seconds left before the name can be registered. */
  secondsLeft: number | null;
}

/**
 * Registers a new `.eth` name on Sepolia whose subnames are its team: the
 * connected wallet deploys the name's own registry and resolver, pays with
 * test USDC, and commits, waits, and registers.
 */
export interface TeamEngine {
  /** Whether `label.eth` can be registered now. */
  isAvailable(label: string, rpcUrl: string): Promise<boolean>;
  /** Runs every step, reporting each change; throws if one fails. */
  create(
    label: string,
    rpcUrl: string,
    onStep: (step: TeamStep, state: TeamStepState) => void,
  ): Promise<void>;
}
