import "server-only";
import { and, count, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { challengeParticipants, entries, entryProgress, mediaItems, mediaTypes, rounds, workflowStates } from "@/db/schema";
import { titleColumns } from "@/modules/media/columns";
import type { ProgressStatus } from "@/modules/entries/labels";
import { describeCadence, isTimeBased, periodAt, todayIn } from "./domain/cadence";
import { currentRoundIndex, formatPeriodLabel, lastRoundIndex } from "./domain/plan";
import { findStrategy, parseStoredConfig } from "./domain/strategies";
import { cadenceOf, type RoundsChallenge } from "./rounds";
import { daysLeft, describeTimeline } from "./timeline";

// Cards for shared lists (home page, group page) tell where a list stands in time: what is on
// this round, how long it lasts, and — for planning lists — what comes next.

export type SummaryInput = RoundsChallenge & { title: string; description: string | null; mediaTypes: string[]; groupName: string };

export type SummaryItem = {
  entryId: string;
  title: string;
  originalTitle: string | null;
  internationalTitle: string | null;
  seasonNumber: number | null;
  imageUrl: string | null;
  icon: string;
  creators: string[];
  mediaType: string;
  myStatus: ProgressStatus | null;
};

export type SharedListSummary = {
  id: string;
  title: string;
  description: string | null;
  groupId: string;
  groupName: string;
  status: SummaryInput["status"];
  mediaTypes: string[];
  cadenceLabel: string;
  strategyLabel: string | null;
  isPlanning: boolean;
  participantCount: number;
  isParticipant: boolean;
  entryCount: number;
  /** Fallback line when no round is running: "1 Ocak 2027 tarihinde başlıyor", "Duraklatıldı"… */
  timeline: string;
  current: { roundId: string | null; label: string; daysLeft: string | null; items: SummaryItem[] } | null;
  upcoming: { label: string; items: SummaryItem[] }[];
};

const UPCOMING_SHOWN = 2;

type RoundRow = { id: string; challengeId: string; index: number; startsOn: string; endsOn: string | null; closedAt: Date | null };

export async function loadSharedListSummaries(userId: string, list: readonly SummaryInput[]): Promise<SharedListSummary[]> {
  if (list.length === 0) return [];
  const ids = list.map((challenge) => challenge.id);

  const [roundRows, participantRows, entryCounts] = await Promise.all([
    db
      .select({
        id: rounds.id,
        challengeId: rounds.challengeId,
        index: rounds.index,
        startsOn: rounds.startsOn,
        endsOn: rounds.endsOn,
        closedAt: rounds.closedAt,
      })
      .from(rounds)
      .where(inArray(rounds.challengeId, ids)),
    db
      .select({ challengeId: challengeParticipants.challengeId, userId: challengeParticipants.userId })
      .from(challengeParticipants)
      .where(and(inArray(challengeParticipants.challengeId, ids), eq(challengeParticipants.isActive, true))),
    db
      .select({ challengeId: entries.challengeId, total: count() })
      .from(entries)
      .where(inArray(entries.challengeId, ids))
      .groupBy(entries.challengeId),
  ]);

  // Which rounds each card shows.
  const plans = list.map((challenge) => planCard(challenge, roundRows.filter((row) => row.challengeId === challenge.id)));
  const roundIds = plans.flatMap((plan) => [plan.current?.roundId, ...plan.upcoming.map((slot) => slot.roundId)]).filter(
    (id): id is string => Boolean(id),
  );

  const itemRows = roundIds.length
    ? await db
        .select({
          entryId: entries.id,
          roundId: entries.roundId,
          createdAt: entries.createdAt,
          ...titleColumns,
          imageUrl: mediaItems.imageUrl,
          creators: mediaItems.creators,
          mediaType: mediaItems.mediaType,
          icon: mediaTypes.icon,
          myStatus: entryProgress.status,
        })
        .from(entries)
        .innerJoin(workflowStates, eq(workflowStates.id, entries.stateId))
        .innerJoin(mediaItems, eq(mediaItems.id, entries.mediaItemId))
        .innerJoin(mediaTypes, eq(mediaTypes.slug, mediaItems.mediaType))
        .leftJoin(entryProgress, and(eq(entryProgress.entryId, entries.id), eq(entryProgress.userId, userId)))
        .where(and(inArray(entries.roundId, roundIds), ne(workflowStates.category, "dropped")))
        .orderBy(entries.createdAt)
    : [];

  const itemsOf = (roundId: string | null): SummaryItem[] =>
    roundId
      ? itemRows
          .filter((row) => row.roundId === roundId)
          .map((row) => ({
            entryId: row.entryId,
            title: row.title,
            originalTitle: row.originalTitle,
            internationalTitle: row.internationalTitle,
            seasonNumber: row.seasonNumber,
            imageUrl: row.imageUrl,
            icon: row.icon,
            creators: row.creators,
            mediaType: row.mediaType,
            myStatus: row.myStatus ?? null,
          }))
      : [];
  const countOf = new Map(entryCounts.map((row) => [row.challengeId, row.total]));

  return list.map((challenge, i) => {
    const plan = plans[i];
    const strategy = findStrategy(challenge.strategy);
    const participants = participantRows.filter((row) => row.challengeId === challenge.id);
    return {
      id: challenge.id,
      title: challenge.title,
      description: challenge.description,
      groupId: challenge.groupId,
      groupName: challenge.groupName,
      status: challenge.status,
      mediaTypes: challenge.mediaTypes,
      cadenceLabel: describeCadence(cadenceOf(challenge)),
      strategyLabel: strategy?.label ?? null,
      isPlanning: plan.isPlanning,
      participantCount: participants.length,
      isParticipant: participants.some((row) => row.userId === userId),
      entryCount: countOf.get(challenge.id) ?? 0,
      timeline: plan.timeline,
      current: plan.current ? { ...plan.current, items: itemsOf(plan.current.roundId) } : null,
      upcoming: plan.upcoming.map((slot) => ({ label: slot.label, items: itemsOf(slot.roundId) })),
    };
  });
}

/** Where a list stands today, before its items are loaded. */
function planCard(challenge: SummaryInput, own: RoundRow[]) {
  const strategy = findStrategy(challenge.strategy);
  const isPlanning = Boolean(strategy?.planning?.(parseStoredConfig(strategy, challenge.strategyConfig)));
  const today = todayIn(challenge.timezone);
  const cadence = cadenceOf(challenge);
  const byIndex = new Map(own.map((row) => [row.index, row]));
  const latestStarted = own.filter((row) => row.startsOn <= today).sort((a, b) => b.index - a.index)[0] ?? null;
  const timeline = describeTimeline({ ...challenge, latestRound: latestStarted }, today);

  let current: { roundId: string | null; label: string; daysLeft: string | null } | null = null;
  const upcoming: { roundId: string | null; label: string }[] = [];
  if (challenge.status !== "active") return { isPlanning, timeline, current, upcoming };

  if (!isTimeBased(cadence)) {
    const open = latestStarted && !latestStarted.closedAt ? latestStarted : null;
    if (open) current = { roundId: open.id, label: `Tur ${open.index + 1}`, daysLeft: null };
    return { isPlanning, timeline, current, upcoming };
  }

  const calendar = { startsOn: challenge.startsOn, endsOn: challenge.endsOn, cadence };
  const last = lastRoundIndex(calendar);
  const index = currentRoundIndex(calendar, today);
  const inRange = (i: number) => i >= 0 && (last === null || i <= last);
  const slot = (i: number) => {
    const period = byIndex.get(i) ?? periodAt(challenge.startsOn, cadence, i, challenge.endsOn);
    return { roundId: byIndex.get(i)?.id ?? null, label: formatPeriodLabel(period.startsOn, period.endsOn), endsOn: period.endsOn };
  };

  if (inRange(index)) {
    const now = slot(index);
    current = { roundId: now.roundId, label: now.label, daysLeft: daysLeft(now.endsOn, today) };
  }
  if (isPlanning) {
    for (let i = Math.max(index + 1, 0); upcoming.length < UPCOMING_SHOWN && inRange(i); i++) {
      const next = slot(i);
      upcoming.push({ roundId: next.roundId, label: next.label });
    }
  }
  return { isPlanning, timeline, current, upcoming };
}
