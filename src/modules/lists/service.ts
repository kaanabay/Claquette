import "server-only";
import { and, count, eq, max, sql } from "drizzle-orm";
import { db, type Executor, type Transaction } from "@/db";
import { listItems, lists, mediaFinishes, mediaItems } from "@/db/schema";
import { AppError, type BatchResult } from "@/lib/action-state";
import { isUuid } from "@/lib/utils";
import { resolveMediaItem, type MediaInput } from "@/modules/media/service";
import { titleColumns } from "@/modules/media/columns";
import { formatTitle } from "@/modules/media/titles";
import type { SortKey } from "@/modules/media/sort";
import { isSameItemSet, MAX_LIST_ITEMS, type ListVisibility } from "./domain";
import { rememberedChoice } from "./finishes";

export type ListFields = { title: string; description: string | null; visibility: ListVisibility; isRanked: boolean };

const notFound = () => new AppError("Liste bulunamadı.");

/** Only the owner may change a list; anyone else gets "not found" (lists don't reveal they exist). */
async function requireOwnList(userId: string, listId: string) {
  if (!isUuid(listId)) throw notFound();
  const [list] = await db.select({ ownerId: lists.ownerId }).from(lists).where(eq(lists.id, listId)).limit(1);
  if (!list || list.ownerId !== userId) throw notFound();
}

/** Same check inside a transaction, locking the list row so concurrent changes run one by one. */
async function lockOwnList(tx: Transaction, userId: string, listId: string) {
  if (!isUuid(listId)) throw notFound();
  const [list] = await tx.select({ ownerId: lists.ownerId }).from(lists).where(eq(lists.id, listId)).for("update");
  if (!list || list.ownerId !== userId) throw notFound();
}

async function requireOwnItem(userId: string, itemId: string) {
  if (!isUuid(itemId)) throw new AppError("Öge bulunamadı.");
  const [item] = await db
    .select({ id: listItems.id, listId: listItems.listId, ownerId: lists.ownerId })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .where(eq(listItems.id, itemId))
    .limit(1);
  if (!item || item.ownerId !== userId) throw new AppError("Öge bulunamadı.");
  return item;
}

const touch = (executor: Executor, listId: string) =>
  executor.update(lists).set({ updatedAt: new Date() }).where(eq(lists.id, listId));

export async function createList(userId: string, fields: ListFields): Promise<string> {
  const [list] = await db
    .insert(lists)
    .values({ ownerId: userId, ...fields })
    .returning({ id: lists.id });
  return list.id;
}

export async function updateList(userId: string, listId: string, fields: Partial<ListFields & { sort: SortKey }>): Promise<void> {
  await requireOwnList(userId, listId);
  await db.update(lists).set(fields).where(eq(lists.id, listId));
}

/** Into the owner's archive (folded at the bottom of "Listelerim") or back out; nothing else about the list changes. */
export async function setListArchived(userId: string, listId: string, archived: boolean): Promise<void> {
  await requireOwnList(userId, listId);
  await db
    .update(lists)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(lists.id, listId));
}

export async function deleteList(userId: string, listId: string): Promise<void> {
  await requireOwnList(userId, listId);
  await db.delete(lists).where(eq(lists.id, listId));
}

/** Appends an item (dated `addedAt`, now by default); returns the new row's id. */
export async function addListItem(
  userId: string,
  listId: string,
  media: MediaInput,
  note: string | null,
  addedAt?: Date,
): Promise<string> {
  await requireOwnList(userId, listId);
  const item = await resolveMediaItem(media, userId); // provider calls stay outside the transaction

  return db.transaction(async (tx) => {
    await lockOwnList(tx, userId, listId); // concurrent adds get distinct positions
    const [{ total, last }] = await tx
      .select({ total: count(), last: max(listItems.position) })
      .from(listItems)
      .where(eq(listItems.listId, listId));
    if (total >= MAX_LIST_ITEMS) throw new AppError(`Bir listede en fazla ${MAX_LIST_ITEMS} öge olabilir.`);

    const inserted = await tx
      .insert(listItems)
      .values({ listId, mediaItemId: item.id, position: (last ?? -1) + 1, note, addedAt })
      .onConflictDoNothing({ target: [listItems.listId, listItems.mediaItemId] })
      .returning({ id: listItems.id });
    if (inserted.length === 0) throw new AppError(`“${formatTitle(item)}” zaten bu listede.`);
    await touch(tx, listId);
    return inserted[0].id;
  });
}

/** Adds several picked items, each on its own; a note is kept only when a single item is added. */
export async function addListItems(
  userId: string,
  listId: string,
  items: { key: string; label: string; media: MediaInput }[],
  note: string | null,
  addedAt?: Date,
): Promise<BatchResult> {
  const result: BatchResult = { added: [], ids: [], failed: [] };
  for (const item of items) {
    try {
      result.ids.push(await addListItem(userId, listId, item.media, items.length === 1 ? note : null, addedAt));
      result.added.push(item.key);
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      result.failed.push({ key: item.key, label: item.label, message: error.message });
    }
  }
  return result;
}

/** What it takes to put a removed item back where it was ("Geri al"). */
export type RemovedListItem = { id: string; listId: string; mediaItemId: string; position: number; note: string | null; addedAt: Date };

/** Removes an item and returns it, so the owner can undo the removal. */
export async function removeListItem(userId: string, itemId: string): Promise<{ title: string; removed: RemovedListItem }> {
  await requireOwnItem(userId, itemId);
  const [removed] = await db.delete(listItems).where(eq(listItems.id, itemId)).returning();
  if (!removed) throw new AppError("Öge bulunamadı.");
  await touch(db, removed.listId);
  const [media] = await db
    .select(titleColumns)
    .from(mediaItems)
    .where(eq(mediaItems.id, removed.mediaItemId));
  return { title: media ? formatTitle(media) : "Öge", removed };
}

/**
 * Puts a removed item back with its note, position and date. The data comes back from the
 * browser, which is fine: it only ever touches the owner's own list, with values they could set.
 */
export async function restoreListItem(userId: string, item: RemovedListItem): Promise<void> {
  await db.transaction(async (tx) => {
    await lockOwnList(tx, userId, item.listId);
    const [{ total }] = await tx.select({ total: count() }).from(listItems).where(eq(listItems.listId, item.listId));
    if (total >= MAX_LIST_ITEMS) throw new AppError(`Bir listede en fazla ${MAX_LIST_ITEMS} öge olabilir.`);
    const inserted = await tx
      .insert(listItems)
      .values(item)
      .onConflictDoNothing()
      .returning({ id: listItems.id });
    if (inserted.length === 0) throw new AppError("Öge zaten listede.");
    await touch(tx, item.listId);
  });
}

/** What "Geri al" needs after a mark changed: the mark before (or none), the item if it left its list, what the list remembered. */
export type FinishUndo = {
  mediaItemId: string;
  previous: { finishedAt: Date; listId: string | null } | null;
  removed: RemovedListItem | null;
  list: { id: string; removeWhenFinished: boolean | null } | null;
};

/**
 * Marks a list item finished on `finishedAt` ("İzledim"; again = another day). The mark is the
 * person's, for the catalog item: with `remove` the item also leaves the list and the mark stays.
 * With `remember` the list keeps that choice for the next time; without it the list forgets any.
 */
export async function finishListItem(
  userId: string,
  itemId: string,
  choice: { finishedAt: Date; remove: boolean; remember: boolean },
): Promise<{ title: string; mediaType: string; undo: FinishUndo }> {
  const owned = await requireOwnItem(userId, itemId);
  const undo = await db.transaction(async (tx) => {
    const [list] = await tx
      .select({ ownerId: lists.ownerId, removeWhenFinished: lists.removeWhenFinished })
      .from(lists)
      .where(eq(lists.id, owned.listId))
      .for("update");
    const [item] = await tx.select().from(listItems).where(eq(listItems.id, itemId));
    if (!list || list.ownerId !== userId || !item) throw new AppError("Öge bulunamadı.");

    const [previous] = await tx
      .select({ finishedAt: mediaFinishes.finishedAt, listId: mediaFinishes.listId })
      .from(mediaFinishes)
      .where(and(eq(mediaFinishes.userId, userId), eq(mediaFinishes.mediaItemId, item.mediaItemId)));
    await tx
      .insert(mediaFinishes)
      .values({ userId, mediaItemId: item.mediaItemId, listId: item.listId, finishedAt: choice.finishedAt })
      .onConflictDoUpdate({
        target: [mediaFinishes.userId, mediaFinishes.mediaItemId],
        set: { listId: item.listId, finishedAt: choice.finishedAt, updatedAt: new Date() },
      });

    const remembered = rememberedChoice(choice.remove, choice.remember);
    const changedList = remembered !== list.removeWhenFinished;
    if (changedList) await tx.update(lists).set({ removeWhenFinished: remembered }).where(eq(lists.id, item.listId));
    if (choice.remove) {
      await tx.delete(listItems).where(eq(listItems.id, item.id));
      await touch(tx, item.listId);
    }
    return {
      mediaItemId: item.mediaItemId,
      previous: previous ?? null,
      removed: choice.remove ? item : null,
      list: changedList ? { id: item.listId, removeWhenFinished: list.removeWhenFinished } : null,
    };
  });
  const [media] = await db
    .select({ ...titleColumns, mediaType: mediaItems.mediaType })
    .from(mediaItems)
    .where(eq(mediaItems.id, undo.mediaItemId));
  return { title: media ? formatTitle(media) : "Öge", mediaType: media?.mediaType ?? "other", undo };
}

/** Takes a mark off ("İşareti kaldır") and hands it back for "Geri al". */
export async function unfinish(userId: string, mediaItemId: string): Promise<{ title: string; undo: FinishUndo }> {
  if (!isUuid(mediaItemId)) throw new AppError("İşaret bulunamadı.");
  const [previous] = await db
    .delete(mediaFinishes)
    .where(and(eq(mediaFinishes.userId, userId), eq(mediaFinishes.mediaItemId, mediaItemId)))
    .returning({ finishedAt: mediaFinishes.finishedAt, listId: mediaFinishes.listId });
  if (!previous) throw new AppError("İşaret bulunamadı.");
  const [media] = await db.select(titleColumns).from(mediaItems).where(eq(mediaItems.id, mediaItemId));
  return { title: media ? formatTitle(media) : "Öge", undo: { mediaItemId, previous, removed: null, list: null } };
}

async function ownsList(userId: string, listId: string): Promise<boolean> {
  const [list] = await db.select({ ownerId: lists.ownerId }).from(lists).where(eq(lists.id, listId)).limit(1);
  return list?.ownerId === userId;
}

/**
 * "Geri al" after a mark or its removal: the item back on its list, what the list remembered, the
 * mark as it was (or none). The data comes back from the browser, which is fine: it only touches the
 * person's own mark and lists, with values they could set themselves.
 */
export async function undoFinish(userId: string, undo: FinishUndo): Promise<void> {
  if (undo.removed) await restoreListItem(userId, undo.removed);
  if (undo.list) {
    await requireOwnList(userId, undo.list.id);
    await db.update(lists).set({ removeWhenFinished: undo.list.removeWhenFinished }).where(eq(lists.id, undo.list.id));
  }
  const mark = and(eq(mediaFinishes.userId, userId), eq(mediaFinishes.mediaItemId, undo.mediaItemId));
  if (!undo.previous) {
    await db.delete(mediaFinishes).where(mark);
    return;
  }
  // A mark only ever points at one of the person's own lists.
  const listId = undo.previous.listId && (await ownsList(userId, undo.previous.listId)) ? undo.previous.listId : null;
  await db
    .insert(mediaFinishes)
    .values({ userId, mediaItemId: undo.mediaItemId, listId, finishedAt: undo.previous.finishedAt })
    .onConflictDoUpdate({
      target: [mediaFinishes.userId, mediaFinishes.mediaItemId],
      set: { listId, finishedAt: undo.previous.finishedAt, updatedAt: new Date() },
    });
}

export async function updateListItemNote(userId: string, itemId: string, note: string | null): Promise<void> {
  const item = await requireOwnItem(userId, itemId);
  await db.update(listItems).set({ note }).where(eq(listItems.id, item.id));
}

/** Moves an item to another day (a "watched" diary filled in later). */
export async function updateListItemDate(userId: string, itemId: string, addedAt: Date): Promise<void> {
  const item = await requireOwnItem(userId, itemId);
  await db.update(listItems).set({ addedAt }).where(eq(listItems.id, item.id));
}

/** Rewrites the order in one statement; the request must name exactly the list's items. */
export async function reorderListItems(userId: string, listId: string, orderedIds: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    await lockOwnList(tx, userId, listId);
    const current = await tx.select({ id: listItems.id }).from(listItems).where(eq(listItems.listId, listId));
    if (!isSameItemSet(current.map((row) => row.id), orderedIds)) {
      throw new AppError("Liste bu sırada değişmiş. Sayfayı yenileyip tekrar dene.");
    }
    if (orderedIds.length === 0) return;
    const rows = sql.join(
      orderedIds.map((id, position) => sql`(${id}::uuid, ${position}::int)`),
      sql`, `,
    );
    await tx.execute(sql`
      update list_items as li set position = v.position
      from (values ${rows}) as v(id, position)
      where li.id = v.id and li.list_id = ${listId}::uuid
    `);
    await touch(tx, listId);
  });
}
