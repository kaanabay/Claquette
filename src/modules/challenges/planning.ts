import "server-only";
import { and, asc, count, eq, isNotNull, ne, type SQL } from "drizzle-orm";
import { db, type Transaction } from "@/db";
import { entries, rounds, workflowStates } from "@/db/schema";
import { AppError } from "@/lib/action-state";
import { isTimeBased, todayIn } from "./domain/cadence";
import {
  currentRoundIndex,
  formatPeriodLabel,
  lastRoundIndex,
  listSlots,
  slotTiming,
  type PlanRound,
  type Slot,
  type SlotTiming,
} from "./domain/plan";
import { getStrategy, parseStoredConfig, type PlanningRules } from "./domain/strategies";
import { cadenceOf, createRoundsThrough, type RoundRow, type RoundsChallenge } from "./rounds";

/** The challenge's planning rules, or null when its strategy doesn't support planning. */
export function planningRules(challenge: Pick<RoundsChallenge, "strategy" | "strategyConfig">): PlanningRules | null {
  const strategy = getStrategy(challenge.strategy);
  return strategy.planning?.(parseStoredConfig(strategy, challenge.strategyConfig)) ?? null;
}

export function roundLabel(challenge: Pick<RoundsChallenge, "cadenceUnit">, round: Pick<RoundRow, "index" | "startsOn" | "endsOn">) {
  return challenge.cadenceUnit === "none" ? `Tur ${round.index + 1}` : formatPeriodLabel(round.startsOn, round.endsOn);
}

export function loadPlanRounds(challengeId: string): Promise<PlanRound[]> {
  return db
    .select({ id: rounds.id, index: rounds.index, startsOn: rounds.startsOn, endsOn: rounds.endsOn, closedAt: rounds.closedAt })
    .from(rounds)
    .where(eq(rounds.challengeId, challengeId))
    .orderBy(asc(rounds.index));
}

export type PlanSlot = Slot & { isFull: boolean };
export type SlotOption = Pick<PlanSlot, "index" | "label" | "timing" | "isFull">;

/** Slots of a planning list with their fill state; `filledByRound` counts non-dropped items. */
export function buildSlots(
  challenge: RoundsChallenge,
  rules: PlanningRules,
  roundRows: readonly PlanRound[],
  filledByRound: ReadonlyMap<string, number>,
  mode: "show" | "select",
): PlanSlot[] {
  return listSlots({
    calendar: { startsOn: challenge.startsOn, endsOn: challenge.endsOn, cadence: cadenceOf(challenge) },
    today: todayIn(challenge.timezone),
    rounds: roundRows,
    filledByRound,
    mode,
  }).map((slot) => ({ ...slot, isFull: rules.itemsPerRound !== null && slot.filled >= rules.itemsPerRound }));
}

export const toSlotOptions = (slots: readonly PlanSlot[]): SlotOption[] =>
  slots.map(({ index, label, timing, isFull }) => ({ index, label, timing, isFull }));

/** Round picker options without loading the list's items (entry page, add form). */
export async function loadSlotOptions(challenge: RoundsChallenge, rules: PlanningRules): Promise<SlotOption[]> {
  const [roundRows, filled] = await Promise.all([
    loadPlanRounds(challenge.id),
    db
      .select({ roundId: entries.roundId, total: count() })
      .from(entries)
      .innerJoin(workflowStates, eq(workflowStates.id, entries.stateId))
      .where(and(eq(entries.challengeId, challenge.id), isNotNull(entries.roundId), ne(workflowStates.category, "dropped")))
      .groupBy(entries.roundId),
  ]);
  const filledByRound = new Map(filled.flatMap((row) => (row.roundId ? [[row.roundId, row.total] as const] : [])));
  return toSlotOptions(buildSlots(challenge, rules, roundRows, filledByRound, "select"));
}

export type LockedSlot = { round: RoundRow; timing: SlotTiming; label: string };

/** A round after the list's end date. */
export class PastLastRoundError extends AppError {}

/**
 * Returns round `index` locked for update, creating it (and any rounds before it) when a
 * time-based list is planned ahead. Indefinite lists only accept their existing turns.
 */
export async function lockSlot(tx: Transaction, challenge: RoundsChallenge, index: number): Promise<LockedSlot> {
  const cadence = cadenceOf(challenge);
  const timeBased = isTimeBased(cadence);
  const calendar = { startsOn: challenge.startsOn, endsOn: challenge.endsOn, cadence };

  if (!Number.isInteger(index) || index < 0) throw new AppError("Geçersiz tur.");
  if (timeBased) {
    const last = lastRoundIndex(calendar);
    if (last !== null && index > last) throw new PastLastRoundError("Bu tur listenin bitiş tarihinden sonra.");
    await createRoundsThrough(tx, challenge, index);
  }

  const [round] = await tx
    .select()
    .from(rounds)
    .where(and(eq(rounds.challengeId, challenge.id), eq(rounds.index, index)))
    .for("update");
  if (!round) throw new AppError("Bu tur henüz başlamadı.");

  const timing = timeBased
    ? slotTiming(index, currentRoundIndex(calendar, todayIn(challenge.timezone)))
    : round.closedAt
      ? "past"
      : "current";
  return { round, timing, label: roundLabel(challenge, round) };
}

/** A full round: adding several items moves on to the next round instead of giving up. */
export class RoundFullError extends AppError {}

/** Throws RoundFullError when the round already holds as many (non-dropped) items as the rules allow. */
export async function assertRoomInRound(
  tx: Transaction,
  roundId: string,
  rules: PlanningRules,
  ignoreEntryId?: string,
): Promise<void> {
  if (rules.itemsPerRound === null) return;
  const conditions: SQL[] = [eq(entries.roundId, roundId), ne(workflowStates.category, "dropped")];
  if (ignoreEntryId) conditions.push(ne(entries.id, ignoreEntryId));
  const [{ total }] = await tx
    .select({ total: count() })
    .from(entries)
    .innerJoin(workflowStates, eq(workflowStates.id, entries.stateId))
    .where(and(...conditions));
  if (total >= rules.itemsPerRound) {
    throw new RoundFullError(
      rules.itemsPerRound === 1
        ? "Bu turda zaten bir öge var. Önce onu başka bir tura taşı ya da başka bir tur seç."
        : `Bu tur dolu (en fazla ${rules.itemsPerRound} öge).`,
    );
  }
}
