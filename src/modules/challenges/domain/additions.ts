// Adding beyond the usual flow (pure): into a round other than the current one, or for someone
// else, on every kind of list. A round that is over can be filled in afterwards: what happened then,
// so the item starts accepted and the form asks who had finished it. On a calendar a round that
// hasn't started takes items too, by the same rule as the current one (see ../targets.ts). Group
// admins may add any participant's item, as if that person had added it and its recipient had
// accepted it: the item is credited to that person, the activity log keeps who entered it.

import type { RoundTiming } from "@/modules/entries/tracking";
import type { AnyStrategy, AssignmentPlan, Participant, PoolRules, SuggestionOptions } from "./strategies";

/** Who may add an item credited to someone: anyone taking part their own, group admins anyone's who takes part. */
export function canAddAs(input: {
  actorId: string;
  creditedId: string;
  actorIsParticipant: boolean;
  creditedIsParticipant: boolean;
  isAdmin: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (input.creditedId === input.actorId) {
    return input.actorIsParticipant ? { ok: true } : { ok: false, reason: "Eklemek için önce listeye katıl." };
  }
  if (!input.isAdmin) return { ok: false, reason: "Başkası adına yalnızca grup yöneticileri ekleyebilir." };
  return input.creditedIsParticipant ? { ok: true } : { ok: false, reason: "Bu kişi listeye katılmıyor." };
}

/**
 * The category an item starts in: what happened in a round that is over, and a round's item added for
 * someone else, are already accepted; anything else (a pool candidate too) starts as the list's rule says.
 * `timing` is null for something that goes into no round.
 */
export function startingCategory(input: {
  timing: RoundTiming | null;
  onBehalf: boolean;
  ruleCategory: "pending" | "active";
}): "pending" | "active" {
  if (input.timing === "past") return "active";
  if (input.timing !== null && input.onBehalf) return "active";
  return input.ruleCategory;
}

/** Putting an item straight into a round of a pool list: as many as the round's selection takes, for everyone. */
export function poolRoundOptions(rules: PoolRules, inRound: number): SuggestionOptions {
  const room = rules.picksPerRound - inRound;
  if (room <= 0) return { allowed: false, reason: "Bu turun seçimi zaten tamamlandı." };
  return { allowed: true, placement: "round", targets: [null], remaining: room, initialCategory: "active" };
}

/** A round's items in play, as the strategy's rule counts them. */
export type RoundItem = { suggestedBy: string | null; recipientId: string | null };

/**
 * What `userId` may add into a round on a list without planning: the strategy's own suggestion rule,
 * asked about that round (its assignments, the person's items in it) instead of the current one.
 */
export function roundOptions(
  strategy: AnyStrategy,
  config: Record<string, unknown>,
  round: { index: number; assignments: readonly AssignmentPlan[]; items: readonly RoundItem[] },
  participants: readonly Participant[],
  userId: string,
): SuggestionOptions {
  return strategy.suggestionOptions({
    config,
    userId,
    participants,
    round: { index: round.index },
    assignments: round.assignments,
    roundSuggestions: round.items.filter((item) => item.suggestedBy === userId),
    poolCandidates: 0,
  });
}

/** An assignment in a list: "<pickerId>:<recipientId>", or "<pickerId>:group". */
export const slotKey = (assignment: AssignmentPlan) => `${assignment.pickerId}:${assignment.recipientId ?? "group"}`;

/**
 * Matches a round's items to its assignments (same picker, same recipient). Items that fit none of
 * them (say, from a turn before the participants changed) are `extras`, shown as they are.
 */
export function fillSlots<A extends AssignmentPlan, E>(
  assignments: readonly A[],
  items: readonly E[],
  pairOf: (item: E) => { pickerId: string | null; recipientId: string | null },
): { slots: (A & { entries: E[] })[]; extras: E[] } {
  const slots = assignments.map((assignment) => ({
    ...assignment,
    entries: items.filter((item) => {
      const pair = pairOf(item);
      return pair.pickerId === assignment.pickerId && pair.recipientId === assignment.recipientId;
    }),
  }));
  const extras = items.filter((item) => !slots.some((slot) => slot.entries.includes(item)));
  return { slots, extras };
}
