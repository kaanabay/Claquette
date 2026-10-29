import "server-only";
import { and, eq, getTableColumns, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { challengeParticipants, challenges, entries, entryProgress, groups, workflowStates } from "@/db/schema";
import { qualified } from "@/db/sql";
import { listParticipants } from "@/modules/challenges/context";
import { todayIn } from "@/modules/challenges/domain/cadence";
import { planningRules } from "@/modules/challenges/planning";
import { syncRounds } from "@/modules/challenges/rounds";
import { getSuggestionState } from "@/modules/challenges/suggestions";
import { loadSharedListSummaries } from "@/modules/challenges/summaries";
import { daysLeft, endedAgo, startsIn } from "@/modules/challenges/timeline";
import { loadEntryCards, type EntryCard } from "@/modules/entries/queries";
import { listMyGroups } from "@/modules/groups/queries";
import { groupAssigned } from "./assigned";

export type TurnTask = {
  challengeId: string;
  challengeTitle: string;
  groupName: string;
  targets: string[];
  remaining: number | null;
  roundIndex: number;
  /** "3 gün kaldı" / "son gün"; null for open-ended turns. */
  deadline: string | null;
};

/** The dashboard answers "what is on now, and what should I do next?" across the user's shared lists. */
export async function getHome(userId: string) {
  const [groupList, myChallenges] = await Promise.all([
    listMyGroups(userId),
    db
      .select({ ...getTableColumns(challenges), timezone: groups.timezone, groupName: groups.name })
      .from(challengeParticipants)
      .innerJoin(challenges, eq(challenges.id, challengeParticipants.challengeId))
      .innerJoin(groups, eq(groups.id, challenges.groupId))
      .where(
        and(
          eq(challengeParticipants.userId, userId),
          eq(challengeParticipants.isActive, true),
          eq(challenges.status, "active"),
        ),
      )
      .orderBy(challenges.title),
  ]);

  await syncRounds(myChallenges);

  // "It's your turn": challenges whose current round assigns the user a pick.
  const turns: TurnTask[] = [];
  for (const challenge of myChallenges) {
    const { options, assignments, round } = await getSuggestionState(challenge, userId);
    if (!round || !options.allowed || !assignments.some((assignment) => assignment.pickerId === userId)) continue;
    const names = new Map((await listParticipants(challenge.id)).map((p) => [p.userId, p.name]));
    turns.push({
      challengeId: challenge.id,
      challengeTitle: challenge.title,
      groupName: challenge.groupName,
      targets: options.targets.map((id) => (id ? (names.get(id) ?? "?") : "tüm grup")),
      remaining: options.remaining,
      roundIndex: round.index,
      deadline: daysLeft(round.endsOn, todayIn(challenge.timezone)),
    });
  }

  const sharedLists = await loadSharedListSummaries(userId, myChallenges);

  const groupIds = groupList.map((group) => group.id);
  const inMyGroups = groupIds.length ? inArray(challenges.groupId, groupIds) : sql`false`;
  const myChallengeIds = myChallenges.map((challenge) => challenge.id);
  const planningIds = myChallenges.filter((challenge) => planningRules(challenge)).map((challenge) => challenge.id);

  const [awaitingAnswer, assignedCards] = await Promise.all([
    loadEntryCards(
      userId,
      and(
        inMyGroups,
        eq(challenges.status, "active"),
        eq(workflowStates.category, "pending"),
        or(
          // personal suggestions waiting for the user's answer
          eq(entries.suggestedFor, userId),
          // ideas others noted down in planning lists, waiting to be put into a round
          planningIds.length
            ? and(inArray(entries.challengeId, planningIds), isNull(entries.roundId), ne(entries.suggestedBy, userId))
            : sql`false`,
        ),
      ),
      12,
    ),
    // Items in a round that are meant for the user and not finished by them ("Bana atananlar").
    loadEntryCards(
      userId,
      and(
        inMyGroups,
        eq(challenges.status, "active"),
        eq(workflowStates.category, "active"),
        isNotNull(entries.roundId),
        or(
          eq(entries.suggestedFor, userId),
          // group-wide entries of challenges the user takes part in
          myChallengeIds.length ? and(isNull(entries.suggestedFor), inArray(entries.challengeId, myChallengeIds)) : sql`false`,
        ),
        sql`not exists (
          select 1 from ${entryProgress} ep
          where ep.entry_id = ${qualified(entries.id)} and ep.user_id = ${userId} and ep.status in ('completed', 'dropped')
        )`,
      ),
      200,
    ),
  ]);

  const timezones = new Map(myChallenges.map((challenge) => [challenge.id, challenge.timezone]));
  const todayOf = (card: EntryCard) => todayIn(timezones.get(card.challengeId) ?? "Europe/Istanbul");
  const byTime = groupAssigned(assignedCards);

  return {
    groups: groupList,
    turns,
    awaitingAnswer,
    sharedLists,
    /** Only for people taking part in a shared list. */
    assigned: myChallenges.length
      ? {
          overdue: byTime.overdue.map((card) => ({ card, note: endedAgo(card.roundEndsOn, todayOf(card)) })),
          current: byTime.current.map((card) => ({ card, note: daysLeft(card.roundEndsOn, todayOf(card)) })),
          upcoming: byTime.upcoming.map((card) => ({
            card,
            note: card.roundStartsOn ? startsIn(card.roundStartsOn, todayOf(card)) : null,
          })),
        }
      : null,
  };
}

export type AssignedItems = NonNullable<Awaited<ReturnType<typeof getHome>>["assigned"]>;
