import "server-only";
import { and, asc, count, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  challenges,
  entries,
  entryProgress,
  entryVotes,
  mediaItems,
  mediaTypes,
  notes,
  rounds,
  users,
  workflowStates,
} from "@/db/schema";
import { isUuid } from "@/lib/utils";
import { listEntryActivity } from "@/modules/activity/service";
import { getChallengeAccess, listParticipants } from "@/modules/challenges/context";
import { canAcceptSuggestion, isPlanStateChangeAllowed } from "@/modules/challenges/domain/plan";
import { loadSlotOptions, planningRules, roundLabel } from "@/modules/challenges/planning";
import { canChangeState, type StateCategory } from "@/modules/workflows/domain";
import { getChallengeStates } from "@/modules/workflows/queries";
import { titleColumns } from "@/modules/media/columns";
import { canDeleteEntry } from "./domain";
import type { ProgressStatus } from "./labels";

export type EntryCard = {
  id: string;
  challengeId: string;
  challengeTitle: string;
  roundId: string | null;
  roundIndex: number | null;
  /** "Kasım 2026" / "13–19 Eki" for time-based lists, "Tur 3" for indefinite ones. */
  roundLabel: string | null;
  /** First day of the item's round (planned rounds may lie in the future). */
  roundStartsOn: string | null;
  state: { id: string; label: string; category: StateCategory; color: string; position: number };
  media: {
    title: string;
    originalTitle: string | null;
    internationalTitle: string | null;
    seasonNumber: number | null;
    mediaType: string;
    icon: string;
    year: number | null;
    creators: string[];
    imageUrl: string | null;
  };
  suggestedBy: { id: string; name: string } | null;
  suggestedFor: { id: string; name: string } | null;
  pitch: string | null;
  createdAt: Date;
  mine: { status: ProgressStatus; rating: number | null } | null;
  stats: { avgRating: number | null; ratingCount: number; completedCount: number };
  votes: number;
  votedByMe: boolean;
};

const suggester = alias(users, "suggester");
const recipient = alias(users, "recipient");

/** Entry cards with the viewer's own progress, group rating stats and pool votes. */
export async function loadEntryCards(userId: string, where: SQL | undefined, limit?: number): Promise<EntryCard[]> {
  let query = db
    .select({
      id: entries.id,
      challengeId: entries.challengeId,
      challengeTitle: challenges.title,
      cadenceUnit: challenges.cadenceUnit,
      roundId: entries.roundId,
      roundIndex: rounds.index,
      roundStartsOn: rounds.startsOn,
      roundEndsOn: rounds.endsOn,
      stateId: workflowStates.id,
      stateLabel: workflowStates.label,
      stateCategory: workflowStates.category,
      stateColor: workflowStates.color,
      statePosition: workflowStates.position,
      ...titleColumns,
      mediaType: mediaItems.mediaType,
      icon: mediaTypes.icon,
      year: mediaItems.year,
      creators: mediaItems.creators,
      imageUrl: mediaItems.imageUrl,
      suggestedById: entries.suggestedBy,
      suggestedByName: suggester.name,
      suggestedForId: entries.suggestedFor,
      suggestedForName: recipient.name,
      pitch: entries.pitch,
      createdAt: entries.createdAt,
    })
    .from(entries)
    .innerJoin(challenges, eq(challenges.id, entries.challengeId))
    .innerJoin(workflowStates, eq(workflowStates.id, entries.stateId))
    .innerJoin(mediaItems, eq(mediaItems.id, entries.mediaItemId))
    .innerJoin(mediaTypes, eq(mediaTypes.slug, mediaItems.mediaType))
    .leftJoin(rounds, eq(rounds.id, entries.roundId))
    .leftJoin(suggester, eq(suggester.id, entries.suggestedBy))
    .leftJoin(recipient, eq(recipient.id, entries.suggestedFor))
    .where(where)
    .orderBy(desc(entries.createdAt))
    .$dynamic();
  if (limit) query = query.limit(limit);
  const rows = await query;
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const [stats, mine, votes] = await Promise.all([
    db
      .select({
        entryId: entryProgress.entryId,
        avgRating: sql<number | null>`avg(${entryProgress.rating})::float`,
        ratingCount: count(entryProgress.rating),
        completedCount: sql<number>`count(*) filter (where ${entryProgress.status} = 'completed')`.mapWith(Number),
      })
      .from(entryProgress)
      .where(inArray(entryProgress.entryId, ids))
      .groupBy(entryProgress.entryId),
    db
      .select({ entryId: entryProgress.entryId, status: entryProgress.status, rating: entryProgress.rating })
      .from(entryProgress)
      .where(and(inArray(entryProgress.entryId, ids), eq(entryProgress.userId, userId))),
    db
      .select({
        entryId: entryVotes.entryId,
        votes: count(),
        votedByMe: sql<boolean>`bool_or(${entryVotes.userId} = ${userId})`,
      })
      .from(entryVotes)
      .where(inArray(entryVotes.entryId, ids))
      .groupBy(entryVotes.entryId),
  ]);

  const statsById = new Map(stats.map((row) => [row.entryId, row]));
  const mineById = new Map(mine.map((row) => [row.entryId, row]));
  const votesById = new Map(votes.map((row) => [row.entryId, row]));

  return rows.map((row) => {
    const stat = statsById.get(row.id);
    const own = mineById.get(row.id);
    const vote = votesById.get(row.id);
    return {
      id: row.id,
      challengeId: row.challengeId,
      challengeTitle: row.challengeTitle,
      roundId: row.roundId,
      roundIndex: row.roundIndex,
      roundLabel:
        row.roundIndex !== null && row.roundStartsOn
          ? roundLabel(row, { index: row.roundIndex, startsOn: row.roundStartsOn, endsOn: row.roundEndsOn })
          : null,
      roundStartsOn: row.roundStartsOn,
      state: {
        id: row.stateId,
        label: row.stateLabel,
        category: row.stateCategory,
        color: row.stateColor,
        position: row.statePosition,
      },
      media: {
        title: row.title,
        originalTitle: row.originalTitle,
        internationalTitle: row.internationalTitle,
        seasonNumber: row.seasonNumber,
        mediaType: row.mediaType,
        icon: row.icon,
        year: row.year,
        creators: row.creators,
        imageUrl: row.imageUrl,
      },
      suggestedBy: row.suggestedById && row.suggestedByName ? { id: row.suggestedById, name: row.suggestedByName } : null,
      suggestedFor: row.suggestedForId && row.suggestedForName ? { id: row.suggestedForId, name: row.suggestedForName } : null,
      pitch: row.pitch,
      createdAt: row.createdAt,
      mine: own ? { status: own.status, rating: own.rating } : null,
      stats: {
        avgRating: stat?.avgRating ?? null,
        ratingCount: stat?.ratingCount ?? 0,
        completedCount: stat?.completedCount ?? 0,
      },
      votes: vote?.votes ?? 0,
      votedByMe: vote?.votedByMe ?? false,
    };
  });
}

export async function getEntryPage(userId: string, entryId: string) {
  if (!isUuid(entryId)) return null;
  const [row] = await db
    .select({
      id: entries.id,
      challengeId: entries.challengeId,
      roundId: entries.roundId,
      stateId: entries.stateId,
      pitch: entries.pitch,
      createdAt: entries.createdAt,
      suggestedById: entries.suggestedBy,
      suggestedByName: suggester.name,
      suggestedForId: entries.suggestedFor,
      suggestedForName: recipient.name,
      media: {
        ...titleColumns,
        mediaType: mediaItems.mediaType,
        year: mediaItems.year,
        creators: mediaItems.creators,
        description: mediaItems.description,
        imageUrl: mediaItems.imageUrl,
        source: mediaItems.source,
        externalUrl: mediaItems.externalUrl,
        metadata: mediaItems.metadata,
      },
      type: { label: mediaTypes.label, icon: mediaTypes.icon, creatorLabel: mediaTypes.creatorLabel },
      roundIndex: rounds.index,
      roundStartsOn: rounds.startsOn,
      roundEndsOn: rounds.endsOn,
    })
    .from(entries)
    .innerJoin(mediaItems, eq(mediaItems.id, entries.mediaItemId))
    .innerJoin(mediaTypes, eq(mediaTypes.slug, mediaItems.mediaType))
    .leftJoin(rounds, eq(rounds.id, entries.roundId))
    .leftJoin(suggester, eq(suggester.id, entries.suggestedBy))
    .leftJoin(recipient, eq(recipient.id, entries.suggestedFor))
    .where(eq(entries.id, entryId))
    .limit(1);
  if (!row) return null;

  const access = await getChallengeAccess(row.challengeId, userId);
  if (!access) return null;

  const [states, participants, progressRows, noteRows, voteRows, activity] = await Promise.all([
    getChallengeStates(row.challengeId),
    listParticipants(row.challengeId),
    db
      .select({
        userId: entryProgress.userId,
        status: entryProgress.status,
        rating: entryProgress.rating,
        name: users.name,
      })
      .from(entryProgress)
      .innerJoin(users, eq(users.id, entryProgress.userId))
      .where(eq(entryProgress.entryId, entryId)),
    db
      .select({
        id: notes.id,
        body: notes.body,
        visibility: notes.visibility,
        isSpoiler: notes.isSpoiler,
        createdAt: notes.createdAt,
        authorId: notes.authorId,
        authorName: users.name,
      })
      .from(notes)
      .innerJoin(users, eq(users.id, notes.authorId))
      .where(and(eq(notes.entryId, entryId), or(eq(notes.visibility, "shared"), eq(notes.authorId, userId))))
      .orderBy(asc(notes.createdAt)),
    db.select({ userId: entryVotes.userId }).from(entryVotes).where(eq(entryVotes.entryId, entryId)),
    listEntryActivity(access.challenge.groupId, entryId),
  ]);

  const current = states.find((state) => state.id === row.stateId)!;
  const planning = planningRules(access.challenge);
  const isSuggestion = row.roundId === null;
  const transitions = states.filter(
    (state) =>
      state.id !== current.id &&
      canChangeState({
        actorId: userId,
        suggestedBy: row.suggestedById,
        suggestedFor: row.suggestedForId,
        currentCategory: current.category,
        targetCategory: state.category,
        isParticipant: access.isParticipant,
        isGroupAdmin: access.isAdmin,
      }) &&
      (!planning || isPlanStateChangeAllowed({ inRound: !isSuggestion, targetCategory: state.category })),
  );

  const isActiveList = access.challenge.status === "active";
  const activeCount = participants.filter((participant) => participant.isActive).length;
  const canAccept =
    planning !== null &&
    isSuggestion &&
    current.category !== "dropped" &&
    isActiveList &&
    canAcceptSuggestion({
      actorId: userId,
      suggestedBy: row.suggestedById,
      isParticipant: access.isParticipant,
      isGroupAdmin: access.isAdmin,
      participantCount: activeCount,
    });
  const canMove =
    planning !== null && !isSuggestion && current.category !== "dropped" && isActiveList && (access.isParticipant || access.isAdmin);
  const slotOptions = planning && (canAccept || canMove) ? await loadSlotOptions(access.challenge, planning) : [];
  const plan = planning
    ? {
        isSuggestion,
        canAccept,
        canMove,
        options: slotOptions,
        defaultIndex:
          (canMove ? row.roundIndex : null) ??
          slotOptions.find((option) => option.timing !== "past" && !option.isFull)?.index ??
          null,
      }
    : null;

  // Everyone taking part, plus anyone else who logged progress.
  const progressById = new Map(progressRows.map((progress) => [progress.userId, progress]));
  const people = participants
    .filter((participant) => participant.isActive || progressById.has(participant.userId))
    .map((participant) => ({ userId: participant.userId, name: participant.name, progress: progressById.get(participant.userId) ?? null }));
  for (const progress of progressRows) {
    if (!people.some((person) => person.userId === progress.userId)) {
      people.push({ userId: progress.userId, name: progress.name, progress });
    }
  }

  return {
    entry: {
      id: row.id,
      pitch: row.pitch,
      createdAt: row.createdAt,
      roundIndex: row.roundIndex,
      roundLabel:
        row.roundIndex !== null && row.roundStartsOn
          ? roundLabel(access.challenge, { index: row.roundIndex, startsOn: row.roundStartsOn, endsOn: row.roundEndsOn })
          : null,
      isPoolCandidate: !planning && row.roundId === null && current.category === "pending",
      suggestedBy: row.suggestedById ? { id: row.suggestedById, name: row.suggestedByName ?? "?" } : null,
      suggestedFor: row.suggestedForId ? { id: row.suggestedForId, name: row.suggestedForName ?? "?" } : null,
      media: row.media,
      type: row.type,
    },
    access,
    states,
    current,
    transitions,
    plan,
    people,
    mine: progressById.get(userId) ?? null,
    notes: noteRows,
    votes: voteRows.length,
    votedByMe: voteRows.some((vote) => vote.userId === userId),
    activity,
    canDelete: canDeleteEntry({ actorId: userId, suggestedBy: row.suggestedById, canManage: access.canManage }),
  };
}

export type EntryPageData = NonNullable<Awaited<ReturnType<typeof getEntryPage>>>;
