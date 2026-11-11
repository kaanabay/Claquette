"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionState, type BatchResult, batchState, toActionState, validationError, validationErrors } from "@/lib/action-state";
import { daySchema, formValues } from "@/lib/forms";
import { requireUser } from "@/modules/auth/session";
import { fromDayValue } from "@/lib/short-date";
import { readMediaToAdd } from "@/modules/media/input";
import { isSortKey, type SortKey } from "@/modules/media/sort";
import { LIST_VISIBILITIES } from "./domain";
import { finishedNotice } from "./finishes";
import {
  addListItems,
  createList,
  deleteList,
  finishListItem,
  type FinishUndo,
  type RemovedListItem,
  removeListItem,
  reorderListItems,
  restoreListItem,
  setListArchived,
  undoFinish,
  unfinish,
  updateList,
  updateListItemDate,
  updateListItemNote,
} from "./service";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `En fazla ${max} karakter.`)
    .optional()
    .transform((value) => value || null);

const checkbox = z
  .string()
  .optional()
  .transform((value) => value === "on");

const listFieldsSchema = z.object({
  title: z.string().trim().min(1, "Listeye bir ad ver.").max(80, "En fazla 80 karakter."),
  description: optionalText(500),
  visibility: z.enum(LIST_VISIBILITIES, "Görünürlük seç."),
  isRanked: checkbox,
});

export async function createListAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = listFieldsSchema.safeParse(formValues(formData));
  if (!parsed.success) return validationError(parsed.error);
  let listId: string;
  try {
    listId = await createList(user.id, parsed.data);
  } catch (error) {
    return toActionState(error);
  }
  redirect(`/lists/${listId}`);
}

/** Shared plumbing for the list page's small forms: auth, validation, error mapping, refresh. */
async function listAction<T extends z.ZodType>(
  formData: FormData,
  schema: T,
  run: (userId: string, input: z.infer<T>) => Promise<string | void>,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = schema.safeParse(formValues(formData));
  if (!parsed.success) return validationError(parsed.error, parsed.error.issues[0]?.message);
  let success: string | void;
  try {
    success = await run(user.id, parsed.data);
  } catch (error) {
    return toActionState(error);
  }
  refresh();
  return success ? { success } : undefined;
}

export async function updateListAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return listAction(formData, listFieldsSchema.extend({ listId: z.uuid() }), async (userId, { listId, ...fields }) => {
    await updateList(userId, listId, fields);
    return "Kaydedildi.";
  });
}

export async function setListVisibilityAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return listAction(
    formData,
    z.object({ listId: z.uuid(), visibility: z.enum(LIST_VISIBILITIES) }),
    (userId, { listId, visibility }) => updateList(userId, listId, { visibility }),
  );
}

/** Called directly by the archive button (and its notice's "Geri al"). */
export async function setListArchivedAction(listId: string, archived: boolean): Promise<ActionState> {
  const user = await requireUser();
  if (!z.uuid().safeParse(listId).success) return { error: "Liste bulunamadı." };
  try {
    await setListArchived(user.id, listId, archived === true);
  } catch (error) {
    return toActionState(error);
  }
  refresh();
  return undefined;
}

export async function deleteListAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const listId = z.uuid().safeParse(formData.get("listId"));
  if (!listId.success) return { error: "Liste bulunamadı." };
  try {
    await deleteList(user.id, listId.data);
  } catch (error) {
    return toActionState(error);
  }
  redirect("/lists");
}

const addItemSchema = z.object({
  listId: z.uuid(),
  note: optionalText(500),
  addedOn: z.union([daySchema, z.literal("")]).optional(),
});

export async function addListItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const values = formValues(formData);
  const parsed = addItemSchema.safeParse(values);
  const media = readMediaToAdd(values);
  if (!parsed.success || !media.ok) return validationErrors([parsed.error, media.ok ? undefined : media.error]);
  if (media.items.length === 0) return { error: "Eklemek için en az bir öge seç." };
  let result: BatchResult;
  try {
    const addedAt = parsed.data.addedOn ? fromDayValue(parsed.data.addedOn) : undefined;
    result = await addListItems(user.id, parsed.data.listId, media.items, parsed.data.note, addedAt);
  } catch (error) {
    return toActionState(error);
  }
  refresh();
  return batchState(result, (count) =>
    count === 1 ? `“${media.items.find((item) => result.added.includes(item.key))?.label}” listeye eklendi.` : `${count} öge listeye eklendi.`,
  );
}

/** Called directly (not from a form): removes at once and hands back what "Geri al" needs. */
export async function removeListItemAction(
  itemId: string,
): Promise<{ error: string } | { title: string; removed: RemovedListItem }> {
  const user = await requireUser();
  if (!z.uuid().safeParse(itemId).success) return { error: "Öge bulunamadı." };
  try {
    const result = await removeListItem(user.id, itemId);
    refresh();
    return result;
  } catch (error) {
    const state = toActionState(error);
    return { error: state?.error ?? "Öge çıkarılamadı." };
  }
}

const removedItemSchema = z.object({
  id: z.uuid(),
  listId: z.uuid(),
  mediaItemId: z.uuid(),
  position: z.number().int().min(0),
  note: z.string().max(500).nullable(),
  addedAt: z.coerce.date(),
});

export async function restoreListItemAction(item: RemovedListItem): Promise<ActionState> {
  const user = await requireUser();
  const parsed = removedItemSchema.safeParse(item);
  if (!parsed.success) return { error: "Öge geri alınamadı." };
  try {
    await restoreListItem(user.id, parsed.data);
  } catch (error) {
    return toActionState(error);
  }
  refresh();
  return undefined;
}

const finishChoiceSchema = z.object({ itemId: z.uuid(), day: daySchema, remove: z.boolean(), remember: z.boolean() });

/** Called directly from the "İzledim" dialog; hands back the notice and what its "Geri al" needs. */
export async function finishListItemAction(input: {
  itemId: string;
  day: string;
  remove: boolean;
  remember: boolean;
}): Promise<{ error: string } | { notice: string; undo: FinishUndo }> {
  const user = await requireUser();
  const parsed = finishChoiceSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "İşaretlenemedi." };
  const { itemId, day, remove, remember } = parsed.data;
  try {
    const result = await finishListItem(user.id, itemId, { finishedAt: fromDayValue(day), remove, remember });
    refresh();
    return { notice: finishedNotice(result.title, result.mediaType, remove), undo: result.undo };
  } catch (error) {
    return { error: toActionState(error)?.error ?? "İşaretlenemedi." };
  }
}

/** "İşareti kaldır" in the dialog; hands back the mark for "Geri al". */
export async function unfinishAction(mediaItemId: string): Promise<{ error: string } | { title: string; undo: FinishUndo }> {
  const user = await requireUser();
  if (!z.uuid().safeParse(mediaItemId).success) return { error: "İşaret bulunamadı." };
  try {
    const result = await unfinish(user.id, mediaItemId);
    refresh();
    return result;
  } catch (error) {
    return { error: toActionState(error)?.error ?? "İşaret kaldırılamadı." };
  }
}

const finishUndoSchema = z.object({
  mediaItemId: z.uuid(),
  previous: z.object({ finishedAt: z.coerce.date(), listId: z.uuid().nullable() }).nullable(),
  removed: removedItemSchema.nullable(),
  list: z.object({ id: z.uuid(), removeWhenFinished: z.boolean().nullable() }).nullable(),
});

export async function undoFinishAction(undo: FinishUndo): Promise<ActionState> {
  const user = await requireUser();
  const parsed = finishUndoSchema.safeParse(undo);
  if (!parsed.success) return { error: "Geri alınamadı." };
  try {
    await undoFinish(user.id, parsed.data);
  } catch (error) {
    return toActionState(error);
  }
  refresh();
  return undefined;
}

export async function updateListItemNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return listAction(formData, z.object({ itemId: z.uuid(), note: optionalText(500) }), async (userId, { itemId, note }) => {
    await updateListItemNote(userId, itemId, note);
    return note ? "Not kaydedildi." : "Not silindi.";
  });
}

export async function updateListItemDateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return listAction(formData, z.object({ itemId: z.uuid(), day: daySchema }), async (userId, { itemId, day }) => {
    await updateListItemDate(userId, itemId, fromDayValue(day));
  });
}

/** Called directly from the order picker: the owner's choice becomes the list's own. */
export async function setListSortAction(listId: string, sort: SortKey): Promise<ActionState> {
  const user = await requireUser();
  if (!z.uuid().safeParse(listId).success || !isSortKey(sort)) return { error: "Sıralama kaydedilemedi." };
  try {
    await updateList(user.id, listId, { sort });
  } catch (error) {
    return toActionState(error);
  }
  refresh();
  return undefined;
}

const reorderSchema = z.object({ listId: z.uuid(), itemIds: z.array(z.uuid()).max(1000) });

/** Called directly (not from a form) when an item is dragged to a new place. */
export async function reorderListItemsAction(listId: string, itemIds: string[]): Promise<ActionState> {
  const user = await requireUser();
  const parsed = reorderSchema.safeParse({ listId, itemIds });
  if (!parsed.success) return { error: "Sıralama kaydedilemedi." };
  try {
    await reorderListItems(user.id, parsed.data.listId, parsed.data.itemIds);
  } catch (error) {
    return toActionState(error);
  }
  refresh();
  return undefined;
}
