// "Bana atananlar" (pure): what the viewer still has to finish, grouped by where its round stands
// in time. Built on the cards' tracking, so it agrees with what the list pages show.

import type { RoundTiming } from "@/modules/entries/tracking";

type AssignableCard = {
  challengeId: string;
  roundIndex: number | null;
  roundStartsOn: string | null;
  roundEndsOn: string | null;
  viewerId: string;
  tracking: { timing: RoundTiming; waiting: readonly { id: string }[] } | null;
};

export type AssignedGroups<T> = {
  /** Rounds that are over: oldest first. */
  overdue: T[];
  /** Running rounds: ending soonest first, open-ended turns last. */
  current: T[];
  /** Each list's next round only, so a plan made a year ahead doesn't flood the page. */
  upcoming: T[];
};

/** The cards still waiting for the viewer, by "Zamanı geçenler", "Devam edenler", "Sıradakiler". */
export function groupAssigned<T extends AssignableCard>(cards: readonly T[]): AssignedGroups<T> {
  const mine = cards.filter((card) => card.tracking?.waiting.some((person) => person.id === card.viewerId));
  const timed = (timing: RoundTiming) => mine.filter((card) => card.tracking?.timing === timing);
  const byEnd = (a: T, b: T) => (a.roundEndsOn ?? "9999-12-31").localeCompare(b.roundEndsOn ?? "9999-12-31");
  const byStart = (a: T, b: T) => (a.roundStartsOn ?? "").localeCompare(b.roundStartsOn ?? "");

  const future = timed("future");
  const nextRound = new Map<string, number>();
  for (const card of future) {
    const index = card.roundIndex ?? Number.POSITIVE_INFINITY;
    nextRound.set(card.challengeId, Math.min(nextRound.get(card.challengeId) ?? Number.POSITIVE_INFINITY, index));
  }

  return {
    overdue: timed("past").sort(byEnd),
    current: timed("current").sort(byEnd),
    upcoming: future.filter((card) => card.roundIndex === nextRound.get(card.challengeId)).sort(byStart),
  };
}
