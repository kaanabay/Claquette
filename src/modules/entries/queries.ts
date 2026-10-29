import "server-only";
import { and, asc, count, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  challengeParticipants,
  challenges,
  entries,
  entryProgress,
  entryVotes,
  groups,
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
import { todayIn } from "@/modules/challenges/domain/cadence";
import { canAcceptSuggestion, isPlanStateChangeAllowed } from "@/modules/challenges/domain/plan";
import { loadSlotOptions, planningRules, roundLabel } from "@/modules/challenges/planning";
import { canChangeState, type StateCategory } from "@/modules/workflows/domain";
import { getChallengeStates } from "@/modules/workflows/queries";
import { titleColumns } from "@/modules/media/columns";
import { canDeleteEntry } from "./domain";
import type { ProgressStatus } from "./labels";
import { assigneesOf, roundTiming, trackEntry, type Tracking } from "./tracking";

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
  /** Last day of the item's round; null for an indefinite list's open turn. */
  roundEndsOn: string | null;
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
  viewerId: string;
  /** Who it is meant for and how far they are; null when the item isn't tracked (see trackEntry). */
  tracking: Tracking | null;
  /** The viewer is one of the people it is meant for, so they can mark it finished from the card. */
  canMark: boolean;
};

const todayCache = () => {
  const byZone = new Map<string, string>();
  return (timeZone: string) => {
    if (!byZone.has(timeZone)) byZone.set(timeZone, todayIn(timeZone));
    return byZone.get(timeZone)!;
  };
};

const suggester = alias(users, "suggester");
const recipient = alias(users, "recipient");

/** Entry cards with everyone's progress (the viewer's own, rating stats, tracking) and pool votes. */
export async function loadEntryCards(userId: string, where: SQL | undefined, limit?: number): Promise<EntryCard[]> {
  let query = db
    .select({
      id: entries.id,
      challengeId: entries.challengeId,
      challengeTitle: challenges.title,
      cadenceUnit: challenges.cadenceUnit,
      timezone: groups.timezone,
      roundId: entries.roundId,
      roundIndex: rounds.index,
      roundStartsOn: rounds.startsOn,
      roundEndsOn: rounds.endsOn,
      roundClosedAt: rounds.closedAt,
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
    .innerJoin(groups, eq(groups.id, challenges.groupId))
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
  const challengeIds = [...new Set(rows.map((row) => row.challengeId))];
  const [progressRows, participantRows, votes] = await Promise.all([
    db
      .select({ entryId: entryProgress.entryId, userId: entryProgress.userId, status: entryProgress.status, rating: entryProgress.rating })
      .from(entryProgress)
      .where(inArray(entryProgress.entryId, ids)),
    db
      .select({ challengeId: challengeParticipants.challengeId, userId: challengeParticipants.userId, name: users.name })
      .from(challengeParticipants)
      .innerJoin(users, eq(users.id, challengeParticipants.userId))
      .where(and(inArray(challengeParticipants.challengeId, challengeIds), eq(challengeParticipants.isActive, true)))
      .orderBy(asc(challengeParticipants.position)),
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

  type Progress = { status: ProgressStatus; rating: number | null };
  const progressByEntry = new Map<string, Map<string, Progress>>();
  for (const { entryId, userId: personId, status, rating } of progressRows) {
    if (!progressByEntry.has(entryId)) progressByEntry.set(entryId, new Map());
    progressByEntry.get(entryId)!.set(personId, { status, rating });
  }
  const participantsByChallenge = new Map<string, { userId: string; name: string }[]>();
  for (const { challengeId, ...participant } of participantRows) {
    participantsByChallenge.set(challengeId, [...(participantsByChallenge.get(challengeId) ?? []), participant]);
  }
  const votesById = new Map(votes.map((row) => [row.entryId, row]));
  const today = todayCache();

  return rows.map((row) => {
    const progress = progressByEntry.get(row.id) ?? new Map<string, Progress>();
    const own = progress.get(userId);
    const ratings = [...progress.values()].flatMap((entry) => (entry.rating === null ? [] : [entry.rating]));
    const vote = votesById.get(row.id);

    const participants = participantsByChallenge.get(row.challengeId) ?? [];
    const names = new Map(participants.map((participant) => [participant.userId, participant.name]));
    if (row.suggestedForId && row.suggestedForName) names.set(row.suggestedForId, row.suggestedForName);
    const assignees = assigneesOf(row.suggestedForId, participants);
    const timing =
      row.roundId && row.roundStartsOn
        ? roundTiming({ startsOn: row.roundStartsOn, endsOn: row.roundEndsOn, closedAt: row.roundClosedAt }, today(row.timezone))
        : null;
    const tracking = trackEntry({
      category: row.stateCategory,
      timing,
      people: assignees.map((id) => ({ id, name: names.get(id) ?? "?", status: progress.get(id)?.status ?? null })),
    });
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
      roundEndsOn: row.roundEndsOn,
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
        avgRating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null,
        ratingCount: ratings.length,
        completedCount: [...progress.values()].filter((entry) => entry.status === "completed").length,
      },
      votes: vote?.votes ?? 0,
      votedByMe: vote?.votedByMe ?? false,
      viewerId: userId,
      tracking,
      canMark: tracking !== null && assignees.includes(userId),
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
      roundClosedAt: rounds.closedAt,
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
        participantCount: activeCount,
        /** Into a round that is over, ask who finished it (a done item already says). */
        askFinished: current.category !== "done",
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

  const assignees = assigneesOf(row.suggestedForId, participants.filter((participant) => participant.isActive));
  const nameOf = (id: string) => people.find((person) => person.userId === id)?.name ?? (id === row.suggestedForId ? row.suggestedForName : null) ?? "?";
  const tracking = trackEntry({
    category: current.category,
    timing: row.roundStartsOn
      ? roundTiming(
          { startsOn: row.roundStartsOn, endsOn: row.roundEndsOn, closedAt: row.roundClosedAt },
          todayIn(access.challenge.timezone),
        )
      : null,
    people: assignees.map((id) => ({ id, name: nameOf(id), status: progressById.get(id)?.status ?? null })),
  });

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
    assignees,
    tracking,
    mine: progressById.get(userId) ?? null,
    notes: noteRows,
    votes: voteRows.length,
    votedByMe: voteRows.some((vote) => vote.userId === userId),
    activity,
    canDelete: canDeleteEntry({ actorId: userId, suggestedBy: row.suggestedById, canManage: access.canManage }),
  };
}

export type EntryPageData = NonNullable<Awaited<ReturnType<typeof getEntryPage>>>;
