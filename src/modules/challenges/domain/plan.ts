import { endOfMonth, format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { formatDateRange } from "@/lib/dates";
import type { StateCategory } from "@/modules/workflows/domain";
import { isTimeBased, periodAt, periodIndexAt, type Cadence } from "./cadence";

// Planning: strategies that support it (see `planning` in ./strategies/types.ts) let people put
// items into any round of a time-based list — past ones to record history, future ones to plan
// ahead. Rounds are still periods of the cadence; these helpers decide which ones to offer.

export type SlotTiming = "past" | "current" | "future";
export type PlanCalendar = { startsOn: string; endsOn: string | null; cadence: Cadence };

/** Empty future rounds always shown after the current (or last planned) one. */
const SHOWN_AHEAD = 3;
/** Future rounds offered when adding or moving an item. Grows with the plan, so there is no hard limit. */
const SELECTABLE_AHEAD = 24;
/** Fixed-length lists up to this many rounds are shown whole ("2027 · 4 quarters"). */
const SHOW_WHOLE_UP_TO = 24;

/** Index of the last round of a fixed-length list; null when it is open-ended. */
export function lastRoundIndex(calendar: PlanCalendar): number | null {
  if (!calendar.endsOn || !isTimeBased(calendar.cadence)) return null;
  return periodIndexAt(calendar.startsOn, calendar.cadence, calendar.endsOn);
}

/** Round containing `today`: -1 before the start, one past the last round after the end. */
export function currentRoundIndex(calendar: PlanCalendar, today: string): number {
  const last = lastRoundIndex(calendar);
  if (last !== null && calendar.endsOn && today > calendar.endsOn) return last + 1;
  return periodIndexAt(calendar.startsOn, calendar.cadence, today);
}

export function slotTiming(index: number, current: number): SlotTiming {
  if (index < current) return "past";
  return index === current ? "current" : "future";
}

/**
 * Last round index to show ("show") or to offer in a picker ("select"). `lastFilledIndex` is the
 * highest round that already has an item (-1 if none), so planning far ahead keeps it visible.
 */
export function planHorizon(
  calendar: PlanCalendar,
  today: string,
  lastFilledIndex: number,
  mode: "show" | "select",
): number {
  const current = Math.max(currentRoundIndex(calendar, today), 0);
  const last = lastRoundIndex(calendar);
  if (mode === "show" && last !== null && last < SHOW_WHOLE_UP_TO) return last;
  const horizon =
    mode === "show"
      ? Math.max(current + SHOWN_AHEAD, lastFilledIndex + 1)
      : Math.max(current, lastFilledIndex) + SELECTABLE_AHEAD;
  return last === null ? horizon : Math.min(horizon, last);
}

export type PlanRound = { id: string; index: number; startsOn: string; endsOn: string | null; closedAt: Date | null };
export type Slot = {
  index: number;
  label: string;
  timing: SlotTiming;
  /** Inclusive last day; null for an indefinite list's open turn. */
  endsOn: string | null;
  roundId: string | null;
  filled: number;
};

/**
 * The rounds to show ("show") or to offer in a picker ("select"), oldest first. For time-based
 * lists this includes future rounds that don't exist yet; they are created when first filled.
 * Indefinite lists have only the turns they already started.
 */
export function listSlots(input: {
  calendar: PlanCalendar;
  today: string;
  rounds: readonly PlanRound[];
  filledByRound: ReadonlyMap<string, number>;
  mode: "show" | "select";
}): Slot[] {
  const { calendar, today, rounds, filledByRound } = input;
  const filled = (round: PlanRound | undefined) => (round ? (filledByRound.get(round.id) ?? 0) : 0);

  if (!isTimeBased(calendar.cadence)) {
    return [...rounds]
      .sort((a, b) => a.index - b.index)
      .map((round) => ({
        index: round.index,
        label: `Tur ${round.index + 1}`,
        timing: round.closedAt ? "past" : "current",
        endsOn: round.endsOn,
        roundId: round.id,
        filled: filled(round),
      }));
  }

  const byIndex = new Map(rounds.map((round) => [round.index, round]));
  const lastFilledIndex = rounds.reduce((last, round) => (filled(round) > 0 ? Math.max(last, round.index) : last), -1);
  const current = currentRoundIndex(calendar, today);
  const horizon = planHorizon(calendar, today, lastFilledIndex, input.mode);

  const slots: Slot[] = [];
  for (let index = 0; index <= horizon; index++) {
    const round = byIndex.get(index);
    const period = round ?? periodAt(calendar.startsOn, calendar.cadence, index, calendar.endsOn);
    slots.push({
      index,
      label: formatPeriodLabel(period.startsOn, period.endsOn),
      timing: slotTiming(index, current),
      endsOn: period.endsOn,
      roundId: round?.id ?? null,
      filled: filled(round),
    });
  }
  return slots;
}

/** "Kasım 2026 · bu tur", "Mart 2026 · geçmiş", "Ocak 2027 · dolu" for round pickers. */
export function describeSlotOption(slot: { label: string; timing: SlotTiming; isFull: boolean }): string {
  const when = slot.timing === "current" ? " · bu tur" : slot.timing === "past" ? " · geçmiş" : "";
  return `${slot.label}${when}${slot.isFull ? " · dolu" : ""}`;
}

/** Items placed into a past round were already read/watched; others are on the agenda. */
export function placementCategory(timing: SlotTiming): "active" | "done" {
  return timing === "past" ? "done" : "active";
}

/**
 * Plain state changes allowed in a planning list: a suggestion is accepted by placing it into a
 * round (not by marking it accepted), and a planned item leaves its round explicitly.
 */
export function isPlanStateChangeAllowed(input: { inRound: boolean; targetCategory: StateCategory }): boolean {
  if (input.inRound) return input.targetCategory !== "pending";
  return input.targetCategory === "pending" || input.targetCategory === "dropped";
}

/**
 * Someone other than its author accepts a suggestion: an idea noted down alone is a question to
 * the others, and their answer is the acceptance. Only a lone participant accepts their own.
 * (Group admins may accept others' suggestions without taking part, but not their own.)
 */
export function canAcceptSuggestion(input: {
  actorId: string;
  suggestedBy: string | null;
  isParticipant: boolean;
  isGroupAdmin: boolean;
  participantCount: number;
}): boolean {
  if (!input.isParticipant && !input.isGroupAdmin) return false;
  return input.actorId !== input.suggestedBy || (input.isParticipant && input.participantCount <= 1);
}

/**
 * Calendar-friendly round names: whole months read as "Kasım 2026", quarters as "Ocak–Mart 2027",
 * a calendar year as "2027". Anything else (weeks, custom anchors) falls back to a date range.
 */
export function formatPeriodLabel(startsOn: string, endsOn: string | null): string {
  if (!endsOn) return formatDateRange(startsOn, endsOn);
  const start = parseISO(startsOn);
  const end = parseISO(endsOn);
  const wholeMonths = start.getDate() === 1 && format(endOfMonth(end), "yyyy-MM-dd") === endsOn;
  if (!wholeMonths) return formatDateRange(startsOn, endsOn);

  const sameYear = start.getFullYear() === end.getFullYear();
  if (sameYear && start.getMonth() === 0 && end.getMonth() === 11) return format(start, "yyyy");
  if (sameYear && start.getMonth() === end.getMonth()) return format(start, "LLLL yyyy", { locale: tr });
  if (sameYear) return `${format(start, "LLLL", { locale: tr })}–${format(end, "LLLL yyyy", { locale: tr })}`;
  return `${format(start, "LLL yyyy", { locale: tr })} – ${format(end, "LLL yyyy", { locale: tr })}`;
}
