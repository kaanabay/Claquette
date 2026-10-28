import "server-only";
import { and, asc, avg, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { entries, entryProgress, mediaItems, mediaTypes, rounds, users, workflowStates } from "@/db/schema";
import { formatDate } from "@/lib/dates";
import { getChallengeAccess } from "@/modules/challenges/context";
import { todayIn } from "@/modules/challenges/domain/cadence";
import { planningRules, roundLabel } from "@/modules/challenges/planning";
import { progressLabel } from "@/modules/entries/labels";
import { getListPage } from "@/modules/lists/queries";
import { titleColumns } from "@/modules/media/columns";
import type { ExportDoc } from "./document";

/** A personal list as anyone who may see it sees it (the owner, or anyone for a public list). */
export async function getListExport(viewerId: string | null, listId: string): Promise<ExportDoc | null> {
  const data = await getListPage(viewerId, listId); // in the list's saved order
  if (!data) return null;
  const { list, items } = data;
  return {
    kind: "list",
    title: list.title,
    subtitle: [`Hazırlayan: ${list.ownerName}`, data.countsLabel, list.isRanked ? "sıralı" : null].filter(Boolean).join(" · "),
    items: items.map((item, index) => ({
      group: null,
      rank: index + 1,
      title: item.media.title,
      originalTitle: item.media.originalTitle,
      internationalTitle: item.media.internationalTitle,
      seasonNumber: item.media.seasonNumber,
      year: item.media.year,
      creators: item.media.creators,
      type: item.type.label,
      icon: item.type.icon,
      imageUrl: item.media.imageUrl,
      note: item.note,
      status: null,
      addedBy: null,
      rating: null,
      ratingCount: 0,
      myStatus: null,
      myRating: null,
      link: item.media.externalUrl,
      addedAt: item.addedAt,
    })),
  };
}

/** Every item of a shared list, round by round (then suggestions or the pool), for its group's members. */
export async function getChallengeExport(userId: string, challengeId: string): Promise<ExportDoc | null> {
  const access = await getChallengeAccess(challengeId, userId);
  if (!access) return null;
  const { challenge } = access;

  const [rows, ratings] = await Promise.all([
    db
      .select({
        id: entries.id,
        pitch: entries.pitch,
        createdAt: entries.createdAt,
        roundIndex: rounds.index,
        roundStartsOn: rounds.startsOn,
        roundEndsOn: rounds.endsOn,
        ...titleColumns,
        mediaType: mediaItems.mediaType,
        year: mediaItems.year,
        creators: mediaItems.creators,
        imageUrl: mediaItems.imageUrl,
        externalUrl: mediaItems.externalUrl,
        type: mediaTypes.label,
        icon: mediaTypes.icon,
        state: workflowStates.label,
        addedBy: users.name,
        myStatus: entryProgress.status,
        myRating: entryProgress.rating,
      })
      .from(entries)
      .innerJoin(mediaItems, eq(mediaItems.id, entries.mediaItemId))
      .innerJoin(mediaTypes, eq(mediaTypes.slug, mediaItems.mediaType))
      .innerJoin(workflowStates, eq(workflowStates.id, entries.stateId))
      .leftJoin(rounds, eq(rounds.id, entries.roundId))
      .leftJoin(users, eq(users.id, entries.suggestedBy))
      .leftJoin(entryProgress, and(eq(entryProgress.entryId, entries.id), eq(entryProgress.userId, userId)))
      .where(eq(entries.challengeId, challenge.id))
      .orderBy(sql`${rounds.index} asc nulls last`, asc(entries.createdAt)),
    db
      .select({ entryId: entryProgress.entryId, average: avg(entryProgress.rating), total: count(entryProgress.rating) })
      .from(entryProgress)
      .innerJoin(entries, eq(entries.id, entryProgress.entryId))
      .where(eq(entries.challengeId, challenge.id))
      .groupBy(entryProgress.entryId),
  ]);

  const byEntry = new Map(ratings.map((row) => [row.entryId, row]));
  const unplaced = planningRules(challenge) ? "Öneri" : challenge.strategy === "pool" ? "Havuz" : null;
  return {
    kind: "challenge",
    title: challenge.title,
    subtitle: `${challenge.groupName} · ${rows.length} öge · ${formatDate(todayIn(challenge.timezone))}`,
    items: rows.map((row) => {
      const rating = byEntry.get(row.id);
      return {
        group:
          row.roundIndex !== null && row.roundStartsOn
            ? roundLabel(challenge, { index: row.roundIndex, startsOn: row.roundStartsOn, endsOn: row.roundEndsOn })
            : unplaced,
        rank: null,
        title: row.title,
        originalTitle: row.originalTitle,
        internationalTitle: row.internationalTitle,
        seasonNumber: row.seasonNumber,
        year: row.year,
        creators: row.creators,
        type: row.type,
        icon: row.icon,
        imageUrl: row.imageUrl,
        note: row.pitch,
        status: row.state,
        addedBy: row.addedBy,
        rating: rating?.average ? Number(rating.average) : null,
        ratingCount: rating?.total ?? 0,
        myStatus: row.myStatus ? progressLabel(row.myStatus, row.mediaType) : null,
        myRating: row.myRating,
        link: row.externalUrl,
        addedAt: row.createdAt,
      };
    }),
  };
}
