// Tracking (pure, no I/O): the list's calendar says when something is due, people say when they
// are done. An entry completes once everyone it is meant for has finished it (or set it aside);
// a round that ended while someone is still to go makes the entry "overdue". Overdue is derived
// from dates and progress on every read, never stored, so it clears the moment the last one finishes.

import type { StateCategory } from "@/modules/workflows/domain";
import type { ProgressStatus } from "./labels";

export type RoundTiming = "past" | "current" | "future";

/** Where a round sits relative to `today` (YYYY-MM-DD in the group's time zone). */
export function roundTiming(round: { startsOn: string; endsOn: string | null; closedAt: Date | null }, today: string): RoundTiming {
  if (round.closedAt || (round.endsOn !== null && round.endsOn < today)) return "past";
  return round.startsOn > today ? "future" : "current";
}

/** Finished it, or set it aside ("Yarım bıraktım"): either way nobody waits for this person. */
export const isSettled = (status: ProgressStatus | null | undefined) => status === "completed" || status === "dropped";

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

/**
 * The category an entry moves to after someone changed their own progress, or null to leave it.
 * Completion follows the assignees; an assignee taking back their "finished" reopens a done entry.
 * Other changes leave a state set by hand alone.
 */
export function stateAfterProgress(input: {
  category: StateCategory;
  /** False for planning suggestions: nothing counts before they are in a round. */
  tracked: boolean;
  outcome: "done" | "open" | null;
  actorIsAssignee: boolean;
  actorWasSettled: boolean;
  actorIsSettled: boolean;
}): "done" | "active" | null {
  if (!input.tracked) return null;
  if (input.outcome === "done" && (input.category === "pending" || input.category === "active")) return "done";
  const tookBack = input.actorIsAssignee && input.actorWasSettled && !input.actorIsSettled;
  return input.outcome === "open" && input.category === "done" && tookBack ? "active" : null;
}

/** "Who finished?" when an item goes into a round that is already over. */
export const FINISHED_CHOICES = ["all", "me", "none"] as const;
export type FinishedChoice = (typeof FINISHED_CHOICES)[number];

/** The people to mark as finished for a choice. */
export function finishedBy(choice: FinishedChoice, assignees: readonly string[], actorId: string): string[] {
  if (choice === "all") return [...assignees];
  return choice === "me" ? [actorId] : [];
}

export type TrackingPerson = { id: string; name: string; status: ProgressStatus | null };

export type Tracking = {
  /** The assignees, with their own progress. */
  people: TrackingPerson[];
  /** Assignees still to finish it (empty once the entry is done). */
  waiting: TrackingPerson[];
  timing: RoundTiming;
  /** The round is over and someone is still to go. */
  overdue: boolean;
};

/**
 * How an entry stands for the people it is meant for. Only items in a round that the group took
 * on are tracked: suggestions, pool candidates, unanswered personal suggestions and dropped items
 * return null.
 */
export function trackEntry(input: {
  category: StateCategory;
  /** Timing of the entry's round; null when it isn't in one. */
  timing: RoundTiming | null;
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

/** "Ali", "sen ve Ali", "Ali, Ayşe ve 2 kişi daha": the viewer reads as "sen". */
export function listPeople(people: readonly { id: string; name: string }[], viewerId: string): string {
  const names = [...people]
    .sort((a, b) => Number(b.id === viewerId) - Number(a.id === viewerId))
    .map((person) => (person.id === viewerId ? "sen" : person.name.split(" ")[0]));
  if (names.length <= 2) return names.join(" ve ");
  return names.length === 3 ? `${names[0]}, ${names[1]} ve ${names[2]}` : `${names[0]}, ${names[1]} ve ${names.length - 2} kişi daha`;
}
