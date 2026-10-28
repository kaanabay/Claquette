import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { entries, roundAssignments, workflowStates } from "@/db/schema";
import type { ChallengeRecord } from "./context";
import { getStrategy, parseStoredConfig, type SuggestionOptions } from "./domain/strategies";
import { activeParticipants, getCurrentRound } from "./rounds";

/**
 * Everything needed to ask the challenge's strategy "what may this user suggest now?".
 * Used by the challenge page (to render the CTA) and by suggestEntry (to enforce it).
 */
export async function getSuggestionState(challenge: ChallengeRecord, userId: string) {
  const strategy = getStrategy(challenge.strategy);
  const config = parseStoredConfig(strategy, challenge.strategyConfig);
  const [participants, round] = await Promise.all([activeParticipants(challenge.id), getCurrentRound(challenge)]);

  const [assignments, mine] = await Promise.all([
    round
      ? db
          .select({ pickerId: roundAssignments.pickerId, recipientId: roundAssignments.recipientId })
          .from(roundAssignments)
          .where(eq(roundAssignments.roundId, round.id))
      : Promise.resolve([]),
    db
      .select({ roundId: entries.roundId, recipientId: entries.suggestedFor, category: workflowStates.category })
      .from(entries)
      .innerJoin(workflowStates, eq(workflowStates.id, entries.stateId))
      .where(
        and(eq(entries.challengeId, challenge.id), eq(entries.suggestedBy, userId), ne(workflowStates.category, "dropped")),
      ),
  ]);

  let options: SuggestionOptions;
  if (challenge.status !== "active") {
    options = { allowed: false, reason: "Liste şu an aktif değil." };
  } else if (!participants.some((participant) => participant.userId === userId)) {
    options = { allowed: false, reason: "Eklemek için önce listeye katıl." };
  } else {
    options = strategy.suggestionOptions({
      config,
      userId,
      participants,
      round: round ? { index: round.index } : null,
      assignments,
      roundSuggestions: round ? mine.filter((entry) => entry.roundId === round.id) : [],
      poolCandidates: mine.filter((entry) => entry.roundId === null && entry.category === "pending").length,
    });
  }

  return { strategy, config, participants, round, assignments, options };
}
