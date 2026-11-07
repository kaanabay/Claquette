import "server-only";
import { and, avg, count, desc, eq, gte, inArray, max, ne, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  activities,
  challengeParticipants,
  challenges,
  entries,
  entryProgress,
  groupMembers,
  groups,
  mediaItems,
  mediaTypes,
  users,
  workflowStates,
} from "@/db/schema";
import { searchText, type FilterKey } from "@/lib/search-text";
import { describeActivity } from "@/modules/activity/describe";
import { isSiteAdmin } from "@/modules/admin/access";
import { todayIn } from "@/modules/challenges/domain/cadence";
import { listMyLists } from "@/modules/lists/queries";
import { titleColumns } from "@/modules/media/columns";
import { activityKind, canViewProfile, type ActivityKind } from "./domain";

/** How far back a profile's history goes. */
const HISTORY_LIMIT = 500;

/** The people the viewer shares a group with ("Kişiler"): most recently active first. */
export async function getPeoplePage(viewerId: string) {
  const mine = await db
    .select({ groupId: groupMembers.groupId, groupName: groups.name })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.userId, viewerId));
  if (mine.length === 0) return [];
  const groupIds = mine.map((row) => row.groupId);

  const members = await db
    .select({ userId: groupMembers.userId, groupId: groupMembers.groupId, name: users.name, username: users.username })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(and(inArray(groupMembers.groupId, groupIds), ne(groupMembers.userId, viewerId)));
  const personIds = [...new Set(members.map((row) => row.userId))];
  if (personIds.length === 0) return [];

  const myLists = db
    .select({ id: challengeParticipants.challengeId })
    .from(challengeParticipants)
    .where(and(eq(challengeParticipants.userId, viewerId), eq(challengeParticipants.isActive, true)));
  const [sharedLists, lastActive] = await Promise.all([
    db
      .select({ userId: challengeParticipants.userId, total: count() })
      .from(challengeParticipants)
      .where(
        and(
          inArray(challengeParticipants.userId, personIds),
          eq(challengeParticipants.isActive, true),
          inArray(challengeParticipants.challengeId, myLists),
        ),
      )
      .groupBy(challengeParticipants.userId),
    db
      .select({ actorId: activities.actorId, at: max(activities.createdAt) })
      .from(activities)
      .where(and(inArray(activities.actorId, personIds), inArray(activities.groupId, groupIds)))
      .groupBy(activities.actorId),
  ]);

  const groupNames = new Map(mine.map((row) => [row.groupId, row.groupName]));
  return personIds
    .map((id) => {
      const rows = members.filter((row) => row.userId === id);
      const groupList = rows.map((row) => groupNames.get(row.groupId) ?? "");
      return {
        id,
        name: rows[0].name,
        username: rows[0].username,
        groups: groupList,
        sharedLists: sharedLists.find((row) => row.userId === id)?.total ?? 0,
        lastActiveAt: lastActive.find((row) => row.actorId === id)?.at ?? null,
        filterKey: { text: searchText([rows[0].name, rows[0].username, ...groupList]) } satisfies FilterKey,
      };
    })
    .sort((a, b) => (b.lastActiveAt?.getTime() ?? 0) - (a.lastActiveAt?.getTime() ?? 0) || a.name.localeCompare(b.name, "tr"));
}

export type PersonRow = Awaited<ReturnType<typeof getPeoplePage>>[number];

export type HistoryItem = {
  id: string;
  kind: ActivityKind;
  sentence: string;
  createdAt: Date;
  challengeId: string | null;
  challengeTitle: string | null;
  entryId: string | null;
  filterKey: FilterKey;
};

/** Someone's name for a page title, when the viewer may open their profile. */
export async function getProfileName(viewerId: string, personId: string): Promise<string | null> {
  const access = await profileAccess(viewerId, personId);
  return access?.person.name ?? null;
}

async function profileAccess(viewerId: string, personId: string) {
  const [person] = await db
    .select({ id: users.id, name: users.name, username: users.username, joinedAt: users.createdAt })
    .from(users)
    .where(eq(users.id, personId))
    .limit(1);
  if (!person) return null;
  const [viewerGroups, personGroups, siteAdmin] = await Promise.all([
    db.select({ id: groupMembers.groupId }).from(groupMembers).where(eq(groupMembers.userId, viewerId)),
    db
      .select({ id: groupMembers.groupId, name: groups.name })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(eq(groupMembers.userId, personId)),
    isSiteAdmin(viewerId),
  ]);
  const visible = new Set(viewerGroups.map((group) => group.id));
  const shared = personGroups.filter((group) => visible.has(group.id));
  if (!canViewProfile({ viewerId, personId, sharedGroups: shared.length, viewerIsSiteAdmin: siteAdmin })) return null;
  return { person, shared, siteAdmin, visibleGroupIds: [...visible] };
}

/**
 * A person's profile as the viewer may see it: what they did in the groups the viewer is in (the
 * site admin: every group), what they are on now there, how many things they finished this year, and
 * their public personal lists. Null when the viewer shares no group with them (it looks missing).
 */
export async function getProfilePage(viewerId: string, personId: string) {
  const access = await profileAccess(viewerId, personId);
  if (!access) return null;
  const { person, shared, siteAdmin, visibleGroupIds } = access;
  const isSelf = viewerId === personId;
  // Only what the viewer could see on the groups' own pages.
  const inVisibleGroups = (column: PgColumn): SQL | undefined => (siteAdmin ? undefined : inArray(column, visibleGroupIds));
  const nothingVisible = !siteAdmin && visibleGroupIds.length === 0;

  const year = todayIn("Europe/Istanbul").slice(0, 4);
  const [activityRows, nowRows, finishedByType, ratings, publicLists] = await Promise.all([
    nothingVisible
      ? Promise.resolve([])
      : db
          .select({
            id: activities.id,
            type: activities.type,
            data: activities.data,
            createdAt: activities.createdAt,
            challengeId: activities.challengeId,
            challengeTitle: challenges.title,
            entryId: activities.entryId,
          })
          .from(activities)
          .leftJoin(challenges, eq(challenges.id, activities.challengeId))
          .where(and(eq(activities.actorId, personId), inVisibleGroups(activities.groupId)))
          .orderBy(desc(activities.createdAt))
          .limit(HISTORY_LIMIT + 1),
    nothingVisible
      ? Promise.resolve([])
      : db
          .select({
            entryId: entries.id,
            challengeId: challenges.id,
            challengeTitle: challenges.title,
            startedAt: entryProgress.startedAt,
            ...titleColumns,
            mediaType: mediaItems.mediaType,
            imageUrl: mediaItems.imageUrl,
            icon: mediaTypes.icon,
          })
          .from(entryProgress)
          .innerJoin(entries, eq(entries.id, entryProgress.entryId))
          .innerJoin(challenges, eq(challenges.id, entries.challengeId))
          .innerJoin(workflowStates, eq(workflowStates.id, entries.stateId))
          .innerJoin(mediaItems, eq(mediaItems.id, entries.mediaItemId))
          .innerJoin(mediaTypes, eq(mediaTypes.slug, mediaItems.mediaType))
          .where(
            and(
              eq(entryProgress.userId, personId),
              eq(entryProgress.status, "in_progress"),
              ne(workflowStates.category, "dropped"),
              inVisibleGroups(challenges.groupId),
            ),
          )
          .orderBy(desc(entryProgress.updatedAt))
          .limit(12),
    nothingVisible
      ? Promise.resolve([])
      : db
          .select({ label: mediaTypes.label, count: count() })
          .from(entryProgress)
          .innerJoin(entries, eq(entries.id, entryProgress.entryId))
          .innerJoin(challenges, eq(challenges.id, entries.challengeId))
          .innerJoin(mediaItems, eq(mediaItems.id, entries.mediaItemId))
          .innerJoin(mediaTypes, eq(mediaTypes.slug, mediaItems.mediaType))
          .where(
            and(
              eq(entryProgress.userId, personId),
              eq(entryProgress.status, "completed"),
              gte(entryProgress.completedAt, new Date(`${year}-01-01T00:00:00+03:00`)),
              inVisibleGroups(challenges.groupId),
            ),
          )
          .groupBy(mediaTypes.label)
          .orderBy(desc(count())),
    nothingVisible
      ? Promise.resolve([])
      : db
          .select({ average: avg(entryProgress.rating), total: count(entryProgress.rating) })
          .from(entryProgress)
          .innerJoin(entries, eq(entries.id, entryProgress.entryId))
          .innerJoin(challenges, eq(challenges.id, entries.challengeId))
          .where(and(eq(entryProgress.userId, personId), inVisibleGroups(challenges.groupId))),
    listMyLists(personId, { publicOnly: true }),
  ]);

  const history: HistoryItem[] = activityRows.slice(0, HISTORY_LIMIT).map((row) => {
    const sentence = describeActivity(row.type, row.data, true);
    const kind = activityKind(row.type, row.data);
    return {
      id: row.id,
      kind,
      sentence,
      createdAt: row.createdAt,
      challengeId: row.challengeId,
      challengeTitle: row.challengeTitle,
      entryId: row.entryId,
      filterKey: { type: kind, text: searchText([sentence, row.challengeTitle]) },
    };
  });
  const rating = ratings[0];

  return {
    person,
    isSelf,
    /** The site admin looking at someone outside their groups. */
    viaSiteAdmin: siteAdmin && !isSelf && shared.length === 0,
    sharedGroups: shared,
    history,
    historyTruncated: activityRows.length > HISTORY_LIMIT,
    now: nowRows,
    stats: {
      year,
      finished: finishedByType,
      averageRating: rating?.average ? Number(rating.average) : null,
      ratingCount: rating?.total ?? 0,
    },
    publicLists,
  };
}

export type ProfilePageData = NonNullable<Awaited<ReturnType<typeof getProfilePage>>>;
