import type { z } from "zod";

// A strategy decides who may suggest what, to whom, and when. Strategies are pure: the
// service layer loads data, asks the strategy, and persists the outcome. Adding a new
// strategy = one file implementing this interface + one line in ./index.ts.

export type Participant = { userId: string; position: number };

/** "pickerId suggests to recipientId this round" (recipientId null = for the whole group). */
export type AssignmentPlan = { pickerId: string; recipientId: string | null };

export type PlanRoundContext<C> = {
  config: C;
  roundIndex: number;
  /** Active participants ordered by position. */
  participants: readonly Participant[];
};

export type SuggestionContext<C> = {
  config: C;
  userId: string;
  /** Active participants ordered by position. */
  participants: readonly Participant[];
  /** The current round; null before the start or after the end. */
  round: { index: number } | null;
  /** Assignments of the current round. */
  assignments: readonly AssignmentPlan[];
  /** The user's suggestions in the current round that are still in play (not dropped). */
  roundSuggestions: readonly { recipientId: string | null }[];
  /** How many of the user's candidates are waiting in the pool. */
  poolCandidates: number;
};

export type SuggestionOptions =
  | {
      allowed: true;
      /**
       * "round": joins the current round; "pool": waits in the shared pool; "plan": the person
       * chooses between putting it into any round (see `planning`) and leaving it as a suggestion.
       */
      placement: "round" | "pool" | "plan";
      /** Allowed recipients; null = the whole group. */
      targets: (string | null)[];
      /** Suggestions left in this scope; null = unlimited. */
      remaining: number | null;
      /** Workflow category a new suggestion starts in. */
      initialCategory: "pending" | "active";
    }
  | { allowed: false; reason: string };

export type PoolSelection = "votes" | "random" | "manual";
export type PoolRules = { picksPerRound: number; selection: PoolSelection; autoDraw: boolean };

/** Rounds of a time-based list can be filled directly, past or future. null = no per-round limit. */
export type PlanningRules = { itemsPerRound: number | null };

/** Declarative description of a config option; the challenge form renders these generically. */
export type ConfigField =
  | {
      type: "select";
      name: string;
      label: string;
      help?: string;
      options: readonly { value: string; label: string }[];
    }
  | { type: "number"; name: string; label: string; help?: string; min: number; max: number }
  | { type: "boolean"; name: string; label: string; help?: string };

export interface ChallengeStrategy<C extends Record<string, unknown>> {
  readonly key: string;
  readonly label: string;
  readonly summary: string;
  readonly configSchema: z.ZodType<C>;
  readonly configFields: readonly ConfigField[];
  /** Assignments stored when a round starts. */
  planRound(ctx: PlanRoundContext<C>): AssignmentPlan[];
  /** What the user may suggest right now, or why not. */
  suggestionOptions(ctx: SuggestionContext<C>): SuggestionOptions;
  /** Present on strategies that collect candidates in a pool and select per round. */
  poolRules?(config: C): PoolRules;
  /** Present on strategies that let people fill any round themselves (see domain/plan.ts). */
  planning?(config: C): PlanningRules;
  /** Short summary of a config for badges, e.g. "Karşılıklı · kişi başı 1 öneri". */
  describeConfig(config: C): string;
}

/** Type-erased form used by the registry and the service layer. */
export type AnyStrategy = ChallengeStrategy<Record<string, unknown>>;

export function defineStrategy<C extends Record<string, unknown>>(strategy: ChallengeStrategy<C>) {
  return strategy;
}
