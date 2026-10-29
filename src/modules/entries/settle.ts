import "server-only";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { challenges, entries, entryProgress, mediaItems, workflowStates } from "@/db/schema";
import { logActivity } from "@/modules/activity/service";
import { activeParticipants } from "@/modules/challenges/rounds";
import { titleColumns } from "@/modules/media/columns";
import { formatTitle } from "@/modules/media/titles";
import { firstStateIn } from "@/modules/workflows/domain";
import { getChallengeStates } from "@/modules/workflows/queries";
import { assigneesOf, progressOutcome } from "./tracking";

/**
 * After the people taking part changed (someone left or was removed), items that everyone still
 * taking part has finished become done. Nothing is reopened: joining never undoes a completion.
 */
export async function settleEntries(challengeId: string): Promise<void> {
  const open = await db
    .select({
      id: entries.id,
      suggestedFor: entries.suggestedFor,
      stateLabel: workflowStates.label,
      groupId: challenges.groupId,
      media: titleColumns,
    })
    .from(entries)
    .innerJoin(workflowStates, eq(workflowStates.id, entries.stateId))
    .innerJoin(challenges, eq(challenges.id, entries.challengeId))
    .innerJoin(mediaItems, eq(mediaItems.id, entries.mediaItemId))
    .where(and(eq(entries.challengeId, challengeId), isNotNull(entries.roundId), eq(workflowStates.category, "active")));
  if (open.length === 0) return;

  const [participants, progress, states] = await Promise.all([
    activeParticipants(challengeId),
    db
      .select({ entryId: entryProgress.entryId, userId: entryProgress.userId, status: entryProgress.status })
      .from(entryProgress)
      .where(inArray(entryProgress.entryId, open.map((entry) => entry.id))),
    getChallengeStates(challengeId),
  ]);
  const done = firstStateIn(states, "done");
  if (!done) return;

  for (const entry of open) {
    const statusOf = (userId: string) => progress.find((row) => row.entryId === entry.id && row.userId === userId)?.status;
    if (progressOutcome(assigneesOf(entry.suggestedFor, participants), statusOf) !== "done") continue;
    await db.transaction(async (tx) => {
      await tx.update(entries).set({ stateId: done.id, stateChangedAt: new Date() }).where(eq(entries.id, entry.id));
      await logActivity(tx, {
        groupId: entry.groupId,
        challengeId,
        entryId: entry.id,
        actorId: null,
        type: "entry.state_changed",
        data: { title: formatTitle(entry.media), from: entry.stateLabel, to: done.label, automatic: true },
      });
    });
  }
}
