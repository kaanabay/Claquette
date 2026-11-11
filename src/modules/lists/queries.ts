import "server-only";
import { and, asc, count, countDistinct, desc, eq, inArray, isNotNull, isNull, lte, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  challengeParticipants,
  challenges,
  entries,
  entryProgress,
  groupMembers,
  groups,
  listItems,
  lists,
  mediaFinishes,
  mediaItems,
  mediaTypes,
  users,
} from "@/db/schema";
import { searchText, type FilterKey } from "@/lib/search-text";
import { isUuid } from "@/lib/utils";
import { titleColumns } from "@/modules/media/columns";
import { describeExisting } from "@/modules/media/keys";
import { type SortKey, sortRows } from "@/modules/media/sort";
import type { CatalogPick } from "@/modules/media/types";
import { canViewList, describeItemCounts } from "./domain";
import { itemFinish, latestFinishes, markIsVisible, type ItemFinish } from "./finishes";
import type { PickCandidate } from "./random-pick";

const COVERS_PER_CARD = 4;

export type ListCover = { imageUrl: string | null; title: string; icon: string };

/** A media type a list holds, and how many of it: for the type filter on "Listelerim". */
export type ListType = { slug: string; label: string; icon: string; total: number };

/** Item counts per media type and the first covers, for cards and previews. */
async function loadListStats(listIds: string[]) {
  if (listIds.length === 0) {
    return { labels: new Map<string, string>(), totals: new Map<string, number>(), types: new Map<string, ListType[]>(), covers: new Map<string, ListCover[]>() };
  }

  const ranked = db
    .select({
      listId: listItems.listId,
      imageUrl: mediaItems.imageUrl,
      title: mediaItems.title,
      icon: mediaTypes.icon,
      rank: sql<number>`row_number() over (partition by ${listItems.listId} order by ${listItems.position}, ${listItems.addedAt})`.as("rank"),
    })
    .from(listItems)
    .innerJoin(mediaItems, eq(mediaItems.id, listItems.mediaItemId))
    .innerJoin(mediaTypes, eq(mediaTypes.slug, mediaItems.mediaType))
    .where(inArray(listItems.listId, listIds))
    .as("ranked");

  const [counts, coverRows] = await Promise.all([
    db
      .select({ listId: listItems.listId, mediaType: mediaItems.mediaType, label: mediaTypes.label, icon: mediaTypes.icon, total: count() })
      .from(listItems)
      .innerJoin(mediaItems, eq(mediaItems.id, listItems.mediaItemId))
      .innerJoin(mediaTypes, eq(mediaTypes.slug, mediaItems.mediaType))
      .where(inArray(listItems.listId, listIds))
      .groupBy(listItems.listId, mediaItems.mediaType, mediaTypes.label, mediaTypes.icon),
    db.select().from(ranked).where(lte(ranked.rank, COVERS_PER_CARD)).orderBy(ranked.listId, ranked.rank),
  ]);

  const labels = new Map<string, string>();
  const totals = new Map<string, number>();
  const types = new Map<string, ListType[]>();
  for (const id of listIds) {
    const own = counts.filter((row) => row.listId === id);
    labels.set(id, describeItemCounts(own));
    totals.set(id, own.reduce((sum, row) => sum + row.total, 0));
    types.set(
      id,
      own.map((row) => ({ slug: row.mediaType, label: row.label, icon: row.icon, total: row.total })).sort((a, b) => b.total - a.total),
    );
  }
  const covers = new Map<string, ListCover[]>();
  for (const row of coverRows) {
    covers.set(row.listId, [...(covers.get(row.listId) ?? []), { imageUrl: row.imageUrl, title: row.title, icon: row.icon }]);
  }
  return { labels, totals, types, covers };
}

/**
 * A person's personal lists, newest change first and archived ones last; `publicOnly` for someone
 * else looking (a profile).
 */
export async function listMyLists(userId: string, options: { publicOnly?: boolean } = {}) {
  const rows = await db
    .select({
      id: lists.id,
      title: lists.title,
      description: lists.description,
      visibility: lists.visibility,
      isRanked: lists.isRanked,
      archivedAt: lists.archivedAt,
      updatedAt: lists.updatedAt,
    })
    .from(lists)
    .where(and(eq(lists.ownerId, userId), options.publicOnly ? eq(lists.visibility, "public") : undefined))
    .orderBy(asc(isNotNull(lists.archivedAt)), desc(lists.updatedAt));
  const stats = await loadListStats(rows.map((row) => row.id));
  return rows.map((row) => {
    const types = stats.types.get(row.id) ?? [];
    return {
      ...row,
      countsLabel: stats.labels.get(row.id) ?? "Henüz boş",
      itemCount: stats.totals.get(row.id) ?? 0,
      types,
      covers: stats.covers.get(row.id) ?? [],
      /** Found on "Listelerim" by its name and description, and by the types it holds. */
      filterKey: { types: types.map((type) => type.slug), text: searchText([row.title, row.description]) } satisfies FilterKey,
    };
  });
}

export type ListSummary = Awaited<ReturnType<typeof listMyLists>>[number];

async function loadList(listId: string) {
  if (!isUuid(listId)) return null;
  const [list] = await db
    .select({
      id: lists.id,
      ownerId: lists.ownerId,
      ownerName: users.name,
      title: lists.title,
      description: lists.description,
      visibility: lists.visibility,
      isRanked: lists.isRanked,
      sort: lists.sort,
      archivedAt: lists.archivedAt,
      removeWhenFinished: lists.removeWhenFinished,
      updatedAt: lists.updatedAt,
    })
    .from(lists)
    .innerJoin(users, eq(users.id, lists.ownerId))
    .where(eq(lists.id, listId))
    .limit(1);
  return list ?? null;
}

/**
 * The list for its owner (editable) or, when public, for anyone; null otherwise. Items come in
 * the list's saved order, or in `sort` when a viewer picked another one. Only the owner learns what
 * of it they finished (`finish`): their marks, and the shared lists they finished an item in.
 */
export async function getListPage(viewerId: string | null, listId: string, options: { sort?: SortKey } = {}) {
  const list = await loadList(listId);
  if (!list || !canViewList(list, viewerId)) return null;
  const isOwner = list.ownerId === viewerId;

  const [items, stats, shareTargets] = await Promise.all([
    db
      .select({
        id: listItems.id,
        note: listItems.note,
        addedAt: listItems.addedAt,
        media: {
          id: mediaItems.id,
          ...titleColumns,
          year: mediaItems.year,
          creators: mediaItems.creators,
          imageUrl: mediaItems.imageUrl,
          mediaType: mediaItems.mediaType,
          externalUrl: mediaItems.externalUrl,
          source: mediaItems.source,
          externalId: mediaItems.externalId,
        },
        type: { icon: mediaTypes.icon, label: mediaTypes.label },
      })
      .from(listItems)
      .innerJoin(mediaItems, eq(mediaItems.id, listItems.mediaItemId))
      .innerJoin(mediaTypes, eq(mediaTypes.slug, mediaItems.mediaType))
      .where(eq(listItems.listId, list.id))
      .orderBy(asc(listItems.position), asc(listItems.addedAt)),
    loadListStats([list.id]),
    isOwner && viewerId ? listShareTargets(viewerId) : Promise.resolve([]),
  ]);

  const finishes = isOwner && viewerId ? await loadItemFinishes(viewerId, items.map((item) => item.media.id)) : new Map<string, ItemFinish>();
  const sort = options.sort ?? list.sort;
  return {
    list,
    isOwner,
    sort,
    items: sortRows(
      items.map((item) => ({ ...item, finish: finishes.get(item.media.id) ?? null })),
      sort,
      (item) => item,
    ),
    countsLabel: stats.labels.get(list.id) ?? "Henüz boş",
    shareTargets,
    existing: describeExisting(items.map((item) => ({ ...item.media, href: `#item-${item.id}` }))),
  };
}

export type ListPageData = NonNullable<Awaited<ReturnType<typeof getListPage>>>;

/** Progress rows in shared lists that count as finished for a person. */
const finishedInSharedLists = (userId: string) => and(eq(entryProgress.userId, userId), eq(entryProgress.status, "completed"));

/** What of these catalog items a person finished: marked on a personal list, or in a shared list of a group they are in. */
async function loadItemFinishes(userId: string, mediaItemIds: string[]): Promise<Map<string, ItemFinish>> {
  if (mediaItemIds.length === 0) return new Map();
  const [marks, shared] = await Promise.all([
    db
      .select({ mediaItemId: mediaFinishes.mediaItemId, finishedAt: mediaFinishes.finishedAt })
      .from(mediaFinishes)
      .where(and(eq(mediaFinishes.userId, userId), inArray(mediaFinishes.mediaItemId, mediaItemIds))),
    db
      .select({
        mediaItemId: entries.mediaItemId,
        entryId: entries.id,
        challengeTitle: challenges.title,
        completedAt: entryProgress.completedAt,
        updatedAt: entryProgress.updatedAt,
      })
      .from(entryProgress)
      .innerJoin(entries, eq(entries.id, entryProgress.entryId))
      .innerJoin(challenges, eq(challenges.id, entries.challengeId))
      .innerJoin(groupMembers, and(eq(groupMembers.groupId, challenges.groupId), eq(groupMembers.userId, userId)))
      .where(and(finishedInSharedLists(userId), inArray(entries.mediaItemId, mediaItemIds))),
  ]);
  const result = new Map<string, ItemFinish>();
  for (const id of new Set(mediaItemIds)) {
    const finish = itemFinish(
      marks.find((mark) => mark.mediaItemId === id),
      shared
        .filter((row) => row.mediaItemId === id)
        .map((row) => ({ entryId: row.entryId, challengeTitle: row.challengeTitle, finishedAt: row.completedAt ?? row.updatedAt })),
    );
    if (finish) result.set(id, finish);
  }
  return result;
}

/** The media columns a shelf or a pick shows. */
const shelfMedia = {
  id: mediaItems.id,
  ...titleColumns,
  year: mediaItems.year,
  creators: mediaItems.creators,
  imageUrl: mediaItems.imageUrl,
  mediaType: mediaItems.mediaType,
};

/** Catalog items a person finished: marked on a personal list, or completed in a shared list of a group they are in. */
async function finishedMediaIds(userId: string): Promise<string[]> {
  const [marks, shared] = await Promise.all([
    db.select({ id: mediaFinishes.mediaItemId }).from(mediaFinishes).where(eq(mediaFinishes.userId, userId)),
    db
      .select({ id: entries.mediaItemId })
      .from(entryProgress)
      .innerJoin(entries, eq(entries.id, entryProgress.entryId))
      .innerJoin(challenges, eq(challenges.id, entries.challengeId))
      .innerJoin(groupMembers, and(eq(groupMembers.groupId, challenges.groupId), eq(groupMembers.userId, userId)))
      .where(finishedInSharedLists(userId)),
  ]);
  return [...new Set([...marks, ...shared].map((row) => row.id))];
}

/** How many candidates the dialog gets to draw from (and turn its reel with). */
const PICK_POOL = 24;

/**
 * "Bana bir şey seç" across the lists: up to two dozen random items of the person's lists outside the
 * archive (of `mediaType`, when given), each catalog item once and none of them finished. `total`
 * counts them all, finished or not, so the dialog can tell "nothing here" from "all done".
 */
export async function pickCandidates(userId: string, mediaType: string | null): Promise<{ total: number; candidates: PickCandidate[] }> {
  const finished = await finishedMediaIds(userId);
  const scope = and(eq(lists.ownerId, userId), isNull(lists.archivedAt), mediaType ? eq(mediaItems.mediaType, mediaType) : undefined);
  const [[counted], rows] = await Promise.all([
    db
      .select({ total: countDistinct(listItems.mediaItemId) })
      .from(listItems)
      .innerJoin(lists, eq(lists.id, listItems.listId))
      .innerJoin(mediaItems, eq(mediaItems.id, listItems.mediaItemId))
      .where(scope),
    db
      .select({
        itemId: listItems.id,
        listId: lists.id,
        listTitle: lists.title,
        media: shelfMedia,
        icon: mediaTypes.icon,
        externalUrl: mediaItems.externalUrl,
      })
      .from(listItems)
      .innerJoin(lists, eq(lists.id, listItems.listId))
      .innerJoin(mediaItems, eq(mediaItems.id, listItems.mediaItemId))
      .innerJoin(mediaTypes, eq(mediaTypes.slug, mediaItems.mediaType))
      .where(and(scope, finished.length > 0 ? notInArray(listItems.mediaItemId, finished) : undefined))
      .orderBy(sql`random()`)
      .limit(PICK_POOL * 3),
  ]);
  const seen = new Set<string>();
  const candidates: PickCandidate[] = [];
  for (const row of rows) {
    if (seen.has(row.media.id) || candidates.length >= PICK_POOL) continue;
    seen.add(row.media.id);
    candidates.push({
      key: row.itemId,
      media: row.media,
      icon: row.icon,
      href: `/lists/${row.listId}#item-${row.itemId}`,
      listTitle: row.listTitle,
      externalUrl: row.externalUrl,
    });
  }
  return { total: Number(counted?.total ?? 0), candidates };
}

/** A finished item on a shelf (a profile, the account archive), and where it was finished. */
export type FinishedRow = {
  mediaItemId: string;
  finishedAt: Date;
  media: {
    id: string;
    title: string;
    originalTitle: string | null;
    internationalTitle: string | null;
    seasonNumber: number | null;
    year: number | null;
    creators: string[];
    imageUrl: string | null;
    mediaType: string;
  };
  type: { icon: string; label: string };
  /** An item of a shared list, or a mark made on a personal list (whose list is null once deleted). */
  source: { kind: "shared"; entryId: string; title: string } | { kind: "list"; listId: string | null; title: string | null };
};

/**
 * Everything a person finished, one row per catalog item at its latest finish, newest first: what
 * they finished in shared lists and what they marked on personal lists. `groupIds`: the groups whose
 * shared lists count ("all" for the site admin); `privateMarks`: whether marks made on private (or
 * deleted) lists count, which only the person may see.
 */
export async function loadFinishedShelf(
  personId: string,
  scope: { groupIds: readonly string[] | "all"; privateMarks: boolean },
): Promise<FinishedRow[]> {
  const noGroups = scope.groupIds !== "all" && scope.groupIds.length === 0;
  const [shared, marks] = await Promise.all([
    noGroups
      ? Promise.resolve([])
      : db
          .select({
            media: shelfMedia,
            type: { icon: mediaTypes.icon, label: mediaTypes.label },
            entryId: entries.id,
            challengeTitle: challenges.title,
            completedAt: entryProgress.completedAt,
            updatedAt: entryProgress.updatedAt,
          })
          .from(entryProgress)
          .innerJoin(entries, eq(entries.id, entryProgress.entryId))
          .innerJoin(challenges, eq(challenges.id, entries.challengeId))
          .innerJoin(mediaItems, eq(mediaItems.id, entries.mediaItemId))
          .innerJoin(mediaTypes, eq(mediaTypes.slug, mediaItems.mediaType))
          .where(and(finishedInSharedLists(personId), scope.groupIds === "all" ? undefined : inArray(challenges.groupId, [...scope.groupIds]))),
    db
      .select({
        media: shelfMedia,
        type: { icon: mediaTypes.icon, label: mediaTypes.label },
        finishedAt: mediaFinishes.finishedAt,
        listId: lists.id,
        listTitle: lists.title,
        visibility: lists.visibility,
      })
      .from(mediaFinishes)
      .innerJoin(mediaItems, eq(mediaItems.id, mediaFinishes.mediaItemId))
      .innerJoin(mediaTypes, eq(mediaTypes.slug, mediaItems.mediaType))
      .leftJoin(lists, eq(lists.id, mediaFinishes.listId))
      .where(eq(mediaFinishes.userId, personId)),
  ]);
  return latestFinishes<FinishedRow>([
    ...shared.map((row) => ({
      mediaItemId: row.media.id,
      finishedAt: row.completedAt ?? row.updatedAt,
      media: row.media,
      type: row.type,
      source: { kind: "shared" as const, entryId: row.entryId, title: row.challengeTitle },
    })),
    ...marks
      .filter((row) => markIsVisible(scope.privateMarks, row.visibility))
      .map((row) => ({
        mediaItemId: row.media.id,
        finishedAt: row.finishedAt,
        media: row.media,
        type: row.type,
        source: { kind: "list" as const, listId: row.listId, title: row.listTitle },
      })),
  ]);
}

/** Shared lists the user can add to (active participant, active list): "Ortak listeye öner". */
async function listShareTargets(userId: string) {
  return db
    .select({ id: challenges.id, title: challenges.title, groupName: groups.name, mediaTypes: challenges.mediaTypes })
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
    .orderBy(asc(groups.name), asc(challenges.title));
}

/** Items from the user's own lists, newest lists first, each media item once ("Listelerimden"). */
export async function listMyPicks(userId: string, allowedTypes: string[]): Promise<CatalogPick[]> {
  if (allowedTypes.length === 0) return [];
  const rows = await db
    .select({
      mediaItemId: mediaItems.id,
      mediaType: mediaItems.mediaType,
      ...titleColumns,
      year: mediaItems.year,
      creators: mediaItems.creators,
      imageUrl: mediaItems.imageUrl,
      icon: mediaTypes.icon,
      listTitle: lists.title,
    })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .innerJoin(mediaItems, eq(mediaItems.id, listItems.mediaItemId))
    .innerJoin(mediaTypes, eq(mediaTypes.slug, mediaItems.mediaType))
    .where(and(eq(lists.ownerId, userId), inArray(mediaItems.mediaType, allowedTypes)))
    .orderBy(desc(lists.updatedAt), asc(listItems.position))
    .limit(300);

  const byItem = new Map<string, CatalogPick>();
  for (const row of rows) {
    if (!byItem.has(row.mediaItemId)) byItem.set(row.mediaItemId, row);
  }
  return [...byItem.values()];
}

/** What a link preview may show: only public lists. */
export async function getPublicListPreview(listId: string) {
  const list = await loadList(listId);
  if (!list || list.visibility !== "public") return null;
  const stats = await loadListStats([list.id]);
  return {
    title: list.title,
    description: list.description,
    ownerName: list.ownerName,
    isRanked: list.isRanked,
    countsLabel: stats.labels.get(list.id) ?? "Henüz boş",
    covers: stats.covers.get(list.id) ?? [],
  };
}

/** Title for the browser tab: public lists for everyone, private ones only for their owner. */
export async function getListTitle(viewerId: string | null, listId: string) {
  const list = await loadList(listId);
  return list && canViewList(list, viewerId) ? list.title : null;
}
