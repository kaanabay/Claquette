import "server-only";
import { and, count, eq, inArray, isNull, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, type Executor } from "@/db";
import { entries, roundAssignments, rounds, users, workflowStates } from "@/db/schema";
import type { EntryCard } from "@/modules/entries/queries";
import { roundTiming, summarizeRound } from "@/modules/entries/tracking";
import { todayIn } from "./domain/cadence";
import { fillSlots, slotKey, type PickTiming } from "./domain/history";
import type { PlanRound } from "./domain/plan";
import { getStrategy, parseStoredConfig, type AssignmentPlan, type HistoryRules } from "./domain/strategies";
import { roundLabel } from "./planning";
import type { RoundRow, RoundsChallenge } from "./rounds";

// Entering picks afterwards (strategies with `history`, see domain/history.ts): the rounds and
// their stored assignments are already there, so a pick only needs a free assignment.

const picker = alias(users, "history_picker");
const recipient = alias(users, "history_recipient");

/** The challenge's history rules, or null when its strategy doesn't fill in past rounds. */
export function historyRules(challenge: Pick<RoundsChallenge, "strategy" | "strategyConfig">): HistoryRules | null {
  const strategy = getStrategy(challenge.strategy);
  return strategy.history?.(parseStoredConfig(strategy, challenge.strategyConfig)) ?? null;
}

export type PickSlot = {
  round: RoundRow;
  timing: PickTiming;
  label: string;
  pickerName: string;
  recipientName: string | null;
  open: number;
};

/**
 * One assignment of a round that is on or over, with how many picks it still takes; or why it
 * can't take one. Who may fill it is `canRecordPick`'s question.
 */
export async function findPickSlot(
  executor: Executor,
  challenge: RoundsChallenge,
  rules: HistoryRules,
  roundIndex: number,
  slot: AssignmentPlan,
): Promise<{ ok: true; slot: PickSlot } | { ok: false; reason: string }> {
  const [round] = await executor
    .select()
    .from(rounds)
    .where(and(eq(rounds.challengeId, challenge.id), eq(rounds.index, roundIndex)))
    .limit(1);
  if (!round) return { ok: false, reason: "Bu tur bulunamadı." };
  const timing = roundTiming(round, todayIn(challenge.timezone));
  if (timing === "future") return { ok: false, reason: "Bu tur henüz başlamadı." };

  const [assignment] = await executor
    .select({ pickerName: picker.name, recipientName: recipient.name })
    .from(roundAssignments)
    .innerJoin(picker, eq(picker.id, roundAssignments.pickerId))
    .leftJoin(recipient, eq(recipient.id, roundAssignments.recipientId))
    .where(
      and(
        eq(roundAssignments.roundId, round.id),
        eq(roundAssignments.pickerId, slot.pickerId),
        slot.recipientId === null ? isNull(roundAssignments.recipientId) : eq(roundAssignments.recipientId, slot.recipientId),
      ),
    )
    .limit(1);
  if (!assignment) return { ok: false, reason: "Bu turda böyle bir öneri sırası yok." };

  const [{ total }] = await executor
    .select({ total: count() })
    .from(entries)
    .innerJoin(workflowStates, eq(workflowStates.id, entries.stateId))
    .where(
      and(
        eq(entries.roundId, round.id),
        eq(entries.suggestedBy, slot.pickerId),
        slot.recipientId === null ? isNull(entries.suggestedFor) : eq(entries.suggestedFor, slot.recipientId),
        ne(workflowStates.category, "dropped"),
      ),
    );
  const open = rules.picksPerAssignment - total;
  if (open <= 0) return { ok: false, reason: "Bu turun bu önerisi zaten girilmiş." };
  return {
    ok: true,
    slot: {
      round,
      timing,
      label: roundLabel(challenge, round),
      pickerName: assignment.pickerName,
      recipientName: assignment.recipientName,
      open,
    },
  };
}

/**
 * Rounds that are over, newest first, each with its assignments (in rotation order) and what was
 * picked for them. `order` holds the participants' ids by position.
 */
export async function loadHistory(
  challenge: RoundsChallenge,
  rules: HistoryRules,
  roundRows: readonly PlanRound[],
  cards: readonly EntryCard[],
  order: readonly string[],
) {
  const today = todayIn(challenge.timezone);
  const past = roundRows.filter((round) => roundTiming(round, today) === "past").sort((a, b) => b.index - a.index);
  if (past.length === 0) return [];

  const rows = await db
    .select({
      roundId: roundAssignments.roundId,
      pickerId: roundAssignments.pickerId,
      pickerName: picker.name,
      recipientId: roundAssignments.recipientId,
      recipientName: recipient.name,
    })
    .from(roundAssignments)
    .innerJoin(picker, eq(picker.id, roundAssignments.pickerId))
    .leftJoin(recipient, eq(recipient.id, roundAssignments.recipientId))
    .where(inArray(roundAssignments.roundId, past.map((round) => round.id)));
  const position = (userId: string) => (order.includes(userId) ? order.indexOf(userId) : order.length);
  rows.sort((a, b) => position(a.pickerId) - position(b.pickerId));

  return past.map((round) => {
    const items = cards.filter((card) => card.roundId === round.id && card.state.category !== "dropped");
    const { slots, extras } = fillSlots(
      rows.filter((row) => row.roundId === round.id),
      items,
      (card) => ({ pickerId: card.suggestedBy?.id ?? null, recipientId: card.suggestedFor?.id ?? null }),
      rules.picksPerAssignment,
    );
    return {
      index: round.index,
      label: roundLabel(challenge, round),
      summary: summarizeRound(items.map((card) => ({ category: card.state.category, tracking: card.tracking }))),
      slots: slots.map((slot) => ({ ...slot, key: slotKey(slot) })),
      extras,
    };
  });
}

export type HistoryRound = Awaited<ReturnType<typeof loadHistory>>[number];
