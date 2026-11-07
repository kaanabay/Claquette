// Where an item sits in its list (pure, no I/O). Nothing new is stored for it: the item's round and
// its state's category say it all. "Tur dışı" is an item outside the rounds that the group took on
// anyway: nobody waits for a round to do it, each person finishes it on their own time (typically
// one of them has already seen it and the others may still want to).

import { canChangeState, type StateCategory } from "@/modules/workflows/domain";

/**
 * - "round": in a round;
 * - "waiting": no round yet, waiting for one (a pool candidate, a planning list's suggestion);
 * - "off": "Tur dışı", no round and taken on (active) or finished (done);
 * - "dropped": set aside, wherever it was.
 */
export type Place = "round" | "waiting" | "off" | "dropped";

export function placeOf(entry: { roundId: string | null; category: StateCategory }): Place {
  if (entry.category === "dropped") return "dropped";
  if (entry.roundId !== null) return "round";
  return entry.category === "pending" ? "waiting" : "off";
}

export const isOffRound = (entry: { roundId: string | null; category: StateCategory }) => placeOf(entry) === "off";

/** UI copy for the place, in one spot so the name reads the same everywhere. */
export const OFF_ROUND = "Tur dışı";

/**
 * Who may take an item out of the rounds (or out of the pool / the suggestions): whoever may move it
 * on in its workflow. A pending personal suggestion is its recipient's to take on, as with accepting it.
 */
export function canTakeOffRound(input: {
  actorId: string;
  suggestedBy: string | null;
  suggestedFor: string | null;
  place: Place;
  category: StateCategory;
  isParticipant: boolean;
  isGroupAdmin: boolean;
}): boolean {
  if (input.place !== "round" && input.place !== "waiting") return false;
  return canChangeState({
    actorId: input.actorId,
    suggestedBy: input.suggestedBy,
    suggestedFor: input.suggestedFor,
    currentCategory: input.category,
    targetCategory: input.category === "pending" ? "active" : input.category,
    isParticipant: input.isParticipant,
    isGroupAdmin: input.isGroupAdmin,
  });
}

/**
 * Where a "Tur dışı" item can go back to on its own: the pool of a pool list, the suggestions of a
 * planning list. Other lists have no such place; there only "Geri al" right after the move returns it
 * to its round. Finished items stay where they are.
 */
export function waitingPlaceOf(list: { pool: boolean; planning: boolean }): "pool" | "suggestions" | null {
  if (list.pool) return "pool";
  return list.planning ? "suggestions" : null;
}
