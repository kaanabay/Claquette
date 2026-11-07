// Tracking (pure, no I/O): the list's calendar says when something is due, people say when they
// are done. An entry completes once everyone it is meant for has finished it (or set it aside);
// a round that ended while someone is still to go makes the entry "overdue". Overdue is derived
// from dates and progress on every read, never stored, so it clears the moment the last one finishes.
// "Tur dışı" items (see placement.ts) are tracked the same way, without a date.

import type { StateCategory } from "@/modules/workflows/domain";
import type { ProgressStatus } from "./labels";
import type { Place } from "./placement";

export type RoundTiming = "past" | "current" | "future";
/** When a tracked item is due: by its round, or never ("off": "Tur dışı"). */
export type TrackTiming = RoundTiming | "off";

/** Where a round sits relative to `today` (YYYY-MM-DD in the group's time zone). */
export function roundTiming(round: { startsOn: string; endsOn: string | null; closedAt: Date | null }, today: string): RoundTiming {
  if (round.closedAt || (round.endsOn !== null && round.endsOn < today)) return "past";
  return round.startsOn > today ? "future" : "current";
}

/** Finished it, set it aside ("Yarım bıraktım") or passed ("İzlemeyeceğim"): either way nobody waits for this person. */
export const isSettled = (status: ProgressStatus | null | undefined) =>
  status === "completed" || status === "dropped" || status === "skipped";

/** Who an entry is meant for: its recipient, or everyone taking part in the list. */
export function assigneesOf(suggestedFor: string | null, participants: readonly { userId: string }[]): string[] {
  return suggestedFor ? [suggestedFor] : participants.map((participant) => participant.userId);
}

/**
 * What personal progress says about the entry as a whole: "done" once every assignee has settled
 * it and at least one finished it, "open" while someone is still to go, null when nobody is
 * assigned or everyone gave up (the group decides those by hand).
 */
export function progressOutcome(
  assignees: readonly string[],
  statusOf: (userId: string) => ProgressStatus | null | undefined,
): "done" | "open" | null {
  if (assignees.length === 0) return null;
  if (assignees.some((userId) => !isSettled(statusOf(userId)))) return "open";
  return assignees.some((userId) => statusOf(userId) === "completed") ? "done" : null;
}

/** Everyone it is meant for is done with it and nobody finished it: nobody will. */
export function everyoneGaveUp(
  assignees: readonly string[],
  statusOf: (userId: string) => ProgressStatus | null | undefined,
): boolean {
  return (
    assignees.length > 0 &&
    assignees.every((userId) => isSettled(statusOf(userId))) &&
    !assignees.some((userId) => statusOf(userId) === "completed")
  );
}

/**
 * The category an entry moves to after someone changed their own progress, or null to leave it.
 * Completion follows the assignees; an assignee taking back their "finished" reopens a done entry.
 * A pool candidate that someone finished (or passed on) alone leaves the pool for "Tur dışı": a round
 * is for something you do together. A "Tur dışı" item that nobody will finish is dropped, as nothing
 * else would ever close it. Other changes leave a state set by hand alone.
 */
export function stateAfterProgress(input: {
  place: Place;
  category: StateCategory;
  /** Planning lists: their suggestions count for nothing before they are in a round. */
  planning: boolean;
  pool: boolean;
  outcome: "done" | "open" | null;
  gaveUp: boolean;
  actorIsAssignee: boolean;
  actorWasSettled: boolean;
  actorIsSettled: boolean;
}): "done" | "active" | "dropped" | null {
  const tracked = input.place === "round" || input.place === "off" || (input.place === "waiting" && !input.planning);
  if (!tracked) return null;
  if (input.outcome === "done" && (input.category === "pending" || input.category === "active")) return "done";
  const tookBack = input.actorIsAssignee && input.actorWasSettled && !input.actorIsSettled;
  if (input.outcome === "open" && input.category === "done" && tookBack) return "active";
  if (input.place === "off" && input.category === "active" && input.gaveUp) return "dropped";
  const settledAlone = input.actorIsAssignee && !input.actorWasSettled && input.actorIsSettled;
  if (input.pool && input.place === "waiting" && settledAlone) return input.gaveUp ? "dropped" : "active";
  return null;
}

/** "Who finished?" when an item goes into a round that is already over. */
export const FINISHED_CHOICES = ["all", "me", "none"] as const;
export type FinishedChoice = (typeof FINISHED_CHOICES)[number];

/** The people to mark as finished for a choice. */
export function finishedBy(choice: FinishedChoice, assignees: readonly string[], actorId: string): string[] {
  if (choice === "all") return [...assignees];
  return choice === "me" ? [actorId] : [];
}

export type TrackingPerson = {
  id: string;
  name: string;
  status: ProgressStatus | null;
  /** The day they finished it, when they did. */
  completedAt?: Date | null;
};

export type Tracking = {
  /** The assignees, with their own progress. */
  people: TrackingPerson[];
  /** Assignees still to finish it (empty once the entry is done). */
  waiting: TrackingPerson[];
  timing: TrackTiming;
  /** The round is over and someone is still to go. */
  overdue: boolean;
};

/**
 * How an entry stands for the people it is meant for. Only items the group took on are tracked:
 * those in a round and "Tur dışı" ones. Suggestions, pool candidates, unanswered personal
 * suggestions and dropped items return null.
 */
export function trackEntry(input: {
  category: StateCategory;
  /** Timing of the entry's round, "off" for a "Tur dışı" item; null when it is waiting for a round. */
  timing: TrackTiming | null;
  people: readonly TrackingPerson[];
}): Tracking | null {
  if (input.timing === null || input.category === "pending" || input.category === "dropped") return null;
  const waiting = input.category === "done" ? [] : input.people.filter((person) => !isSettled(person.status));
  return {
    people: [...input.people],
    waiting,
    timing: input.timing,
    overdue: input.timing === "past" && input.category === "active" && waiting.length > 0,
  };
}

export type RoundSummary = { done: number; total: number; waiting: TrackingPerson[] };

/** A round at a glance ("2/2 bitti"), from its items in play: how many are done, who is still to go. */
export function summarizeRound(items: readonly { category: StateCategory; tracking: Tracking | null }[]): RoundSummary {
  const waiting = new Map<string, TrackingPerson>();
  for (const item of items) {
    for (const person of item.tracking?.waiting ?? []) waiting.set(person.id, person);
  }
  return { done: items.filter((item) => item.category === "done").length, total: items.length, waiting: [...waiting.values()] };
}

/** "2/2 bitti", or "1/2 bitti · bitirmeyen: Ali" once the round is over; null for an empty round. */
export function describeRoundSummary(summary: RoundSummary, viewerId: string, over: boolean): string | null {
  if (summary.total === 0) return null;
  const counted = `${summary.done}/${summary.total} bitti`;
  return over && summary.waiting.length > 0 ? `${counted} · bitirmeyen: ${listPeople(summary.waiting, viewerId)}` : counted;
}

/** "Ali", "sen ve Ali", "Ali, Ayşe ve 2 kişi daha": the viewer reads as "sen". */
export function listPeople(people: readonly { id: string; name: string }[], viewerId: string): string {
  const names = [...people]
    .sort((a, b) => Number(b.id === viewerId) - Number(a.id === viewerId))
    .map((person) => (person.id === viewerId ? "sen" : person.name.split(" ")[0]));
  if (names.length <= 2) return names.join(" ve ");
  return names.length === 3 ? `${names[0]}, ${names[1]} ve ${names[2]}` : `${names[0]}, ${names[1]} ve ${names.length - 2} kişi daha`;
}
