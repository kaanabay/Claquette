import "server-only";
import { and, asc, count, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { challengeParticipants, challenges, groups, listItems, lists, mediaItems, mediaTypes, users } from "@/db/schema";
import { isUuid } from "@/lib/utils";
import { titleColumns } from "@/modules/media/columns";
import { describeExisting } from "@/modules/media/keys";
import { type SortKey, sortRows } from "@/modules/media/sort";
import type { CatalogPick } from "@/modules/media/types";
import { canViewList, describeItemCounts } from "./domain";

const COVERS_PER_CARD = 4;

export type ListCover = { imageUrl: string | null; title: string; icon: string };

/** Item counts per media type and the first covers, for cards and previews. */
async function loadListStats(listIds: string[]) {
  if (listIds.length === 0) return { labels: new Map<string, string>(), totals: new Map<string, number>(), covers: new Map<string, ListCover[]>() };

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
      .select({ listId: listItems.listId, mediaType: mediaItems.mediaType, total: count() })
      .from(listItems)
      .innerJoin(mediaItems, eq(mediaItems.id, listItems.mediaItemId))
      .where(inArray(listItems.listId, listIds))
      .groupBy(listItems.listId, mediaItems.mediaType),
    db.select().from(ranked).where(lte(ranked.rank, COVERS_PER_CARD)).orderBy(ranked.listId, ranked.rank),
  ]);

  const labels = new Map<string, string>();
  const totals = new Map<string, number>();
  for (const id of listIds) {
    const own = counts.filter((row) => row.listId === id);
    labels.set(id, describeItemCounts(own));
    totals.set(id, own.reduce((sum, row) => sum + row.total, 0));
  }
  const covers = new Map<string, ListCover[]>();
  for (const row of coverRows) {
    covers.set(row.listId, [...(covers.get(row.listId) ?? []), { imageUrl: row.imageUrl, title: row.title, icon: row.icon }]);
  }
  return { labels, totals, covers };
}

export async function listMyLists(userId: string) {
  const rows = await db
    .select({
      id: lists.id,
      title: lists.title,
      description: lists.description,
      visibility: lists.visibility,
      isRanked: lists.isRanked,
      updatedAt: lists.updatedAt,
    })
    .from(lists)
    .where(eq(lists.ownerId, userId))
    .orderBy(desc(lists.updatedAt));
  const stats = await loadListStats(rows.map((row) => row.id));
  return rows.map((row) => ({
    ...row,
    countsLabel: stats.labels.get(row.id) ?? "Henüz boş",
    itemCount: stats.totals.get(row.id) ?? 0,
    covers: stats.covers.get(row.id) ?? [],
  }));
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
 * the list's saved order, or in `sort` when a viewer picked another one.
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

  const sort = options.sort ?? list.sort;
  return {
    list,
    isOwner,
    sort,
    items: sortRows(items, sort, (item) => item),
    countsLabel: stats.labels.get(list.id) ?? "Henüz boş",
    shareTargets,
    existing: describeExisting(items.map((item) => ({ ...item.media, href: `#item-${item.id}` }))),
  };
}

export type ListPageData = NonNullable<Awaited<ReturnType<typeof getListPage>>>;

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
