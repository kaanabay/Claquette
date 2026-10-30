// History (pure): strategies with `history` (see ./strategies/types.ts) let picks be entered
// afterwards, one stored assignment at a time: "in March Ali picked Persona for Kaan". The item is
// credited to the assignment's picker, whoever enters it, so the list reads as it happened.

import type { AssignmentPlan } from "./strategies";

/** An assignment in a link or form: "<pickerId>:<recipientId>", or "<pickerId>:group". */
export function slotKey(assignment: AssignmentPlan): string {
  return `${assignment.pickerId}:${assignment.recipientId ?? "group"}`;
}

export function parseSlotKey(key: string): AssignmentPlan | null {
  const parts = key.split(":");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { pickerId: parts[0], recipientId: parts[1] === "group" ? null : parts[1] };
}

export type PickTiming = "past" | "current";

/**
 * Who may enter a pick for an assignment: its picker, once the round is over (the current one goes
 * through the usual suggestion, which its recipient accepts), and group admins anyone's, then or
 * now, as if the picker had added it and the recipient had accepted it.
 */
export function canRecordPick(input: {
  actorId: string;
  pickerId: string;
  timing: PickTiming;
  isParticipant: boolean;
  isAdmin: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (input.pickerId !== input.actorId) {
    return input.isAdmin ? { ok: true } : { ok: false, reason: "Başkasının önerisini yalnızca grup yöneticileri girebilir." };
  }
  if (input.timing === "current") return { ok: false, reason: "Bu turdaki önerini “Öneri yap” ile gönderirsin." };
  return input.isParticipant || input.isAdmin ? { ok: true } : { ok: false, reason: "Geçmişi doldurmak için önce listeye katıl." };
}

export type FilledSlot<A, E> = A & { entries: E[]; open: number };

/**
 * Matches a round's items to its assignments (same picker, same recipient). `open` is how many
 * more picks the assignment takes; items that fit none of them (say, from someone's turn before
 * the participants changed) are `extras`, shown as they are.
 */
export function fillSlots<A extends AssignmentPlan, E>(
  assignments: readonly A[],
  items: readonly E[],
  pairOf: (item: E) => { pickerId: string | null; recipientId: string | null },
  picksPerAssignment: number,
): { slots: FilledSlot<A, E>[]; extras: E[] } {
  const slots = assignments.map((assignment) => {
    const entries = items.filter((item) => {
      const pair = pairOf(item);
      return pair.pickerId === assignment.pickerId && pair.recipientId === assignment.recipientId;
    });
    return { ...assignment, entries, open: Math.max(0, picksPerAssignment - entries.length) };
  });
  const extras = items.filter((item) => !slots.some((slot) => slot.entries.includes(item)));
  return { slots, extras };
}
