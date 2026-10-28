import "server-only";
import { and, count, eq, inArray, isNull, ne } from "drizzle-orm";
import { db, type Transaction } from "@/db";
import { entries, entryVotes, mediaItems, rounds, workflowStates } from "@/db/schema";
import { logActivity } from "@/modules/activity/service";
import { titleColumns } from "@/modules/media/columns";
import { formatTitle, type Titled } from "@/modules/media/titles";
import { initialState } from "@/modules/workflows/domain";
import { getChallengeStates } from "@/modules/workflows/queries";
import { pickFromPool, type PoolRules } from "./domain/strategies";

type RoundTarget = { challengeId: string; groupId: string; roundId: string };

/** Candidates waiting in the pool (no round yet, still pending), with their vote counts. */
async function poolCandidates(tx: Transaction, challengeId: string) {
  const candidates = await tx
    .select({ id: entries.id, ...titleColumns })
    .from(entries)
    .innerJoin(workflowStates, eq(workflowStates.id, entries.stateId))
    .innerJoin(mediaItems, eq(mediaItems.id, entries.mediaItemId))
    .where(and(eq(entries.challengeId, challengeId), isNull(entries.roundId), eq(workflowStates.category, "pending")));
  if (candidates.length === 0) return [];

  const votes = await tx
    .select({ entryId: entryVotes.entryId, total: count() })
    .from(entryVotes)
    .where(inArray(entryVotes.entryId, candidates.map((candidate) => candidate.id)))
    .groupBy(entryVotes.entryId);
  const votesById = new Map(votes.map((row) => [row.entryId, row.total]));
  return candidates.map((candidate) => ({ ...candidate, votes: votesById.get(candidate.id) ?? 0 }));
}

/** Locks the round (serializes concurrent draws) and returns how many slots are still open. */
async function openSlots(tx: Transaction, roundId: string, picksPerRound: number): Promise<number> {
  await tx.select({ id: rounds.id }).from(rounds).where(eq(rounds.id, roundId)).for("update");
  const [{ selected }] = await tx
    .select({ selected: count() })
    .from(entries)
    .innerJoin(workflowStates, eq(workflowStates.id, entries.stateId))
    .where(and(eq(entries.roundId, roundId), ne(workflowStates.category, "dropped")));
  return picksPerRound - selected;
}

async function moveIntoRound(
  tx: Transaction,
  target: RoundTarget,
  picks: ({ id: string; votes: number } & Titled)[],
  actorId: string | null,
  method: string,
) {
  if (picks.length === 0) return;
  const states = await getChallengeStates(target.challengeId, tx);
  const activeState = initialState(states, "active");
  await tx
    .update(entries)
    .set({ roundId: target.roundId, stateId: activeState.id, stateChangedAt: new Date() })
    .where(inArray(entries.id, picks.map((pick) => pick.id)));
  for (const pick of picks) {
    await logActivity(tx, {
      groupId: target.groupId,
      challengeId: target.challengeId,
      entryId: pick.id,
      actorId,
      type: "entry.selected",
      data: { title: formatTitle(pick), method, votes: pick.votes },
    });
  }
}

/** Fills the round's open slots from the pool according to the strategy's rules. */
export async function drawForRound(target: RoundTarget, rules: PoolRules, actorId: string | null): Promise<number> {
  return db.transaction(async (tx) => {
    const slots = await openSlots(tx, target.roundId, rules.picksPerRound);
    if (slots <= 0) return 0;
    const picks = pickFromPool(await poolCandidates(tx, target.challengeId), slots, rules.selection);
    await moveIntoRound(tx, target, picks, actorId, rules.selection);
    return picks.length;
  });
}

/** Manual selection of one specific candidate. Returns false when the round is already full. */
export async function selectIntoRound(
  target: RoundTarget,
  entryId: string,
  rules: PoolRules,
  actorId: string,
): Promise<"selected" | "full" | "unavailable"> {
  return db.transaction(async (tx) => {
    if ((await openSlots(tx, target.roundId, rules.picksPerRound)) <= 0) return "full";
    const candidate = (await poolCandidates(tx, target.challengeId)).find((c) => c.id === entryId);
    if (!candidate) return "unavailable";
    await moveIntoRound(tx, target, [candidate], actorId, "manual");
    return "selected";
  });
}
