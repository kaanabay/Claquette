"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionState, type BatchResult, batchState, toActionState, validationError, validationErrors } from "@/lib/action-state";
import { formValues } from "@/lib/forms";
import { requireUser } from "@/modules/auth/session";
import { readMediaToAdd } from "@/modules/media/input";
import { PROGRESS_STATUSES, type ProgressStatus } from "./labels";
import {
  addNote,
  changeEntryState,
  deleteEntry,
  deleteNote,
  placeEntry,
  suggestEntries,
  toggleVote,
  unplanEntry,
  updateProgress,
} from "./service";
import { FINISHED_CHOICES } from "./tracking";

const emptyToNull = (value: string | undefined) => value || null;

const suggestSchema = z.object({
  challengeId: z.uuid(),
  recipientId: z.string().optional().transform(emptyToNull),
  pitch: z.string().trim().max(500, "En fazla 500 karakter.").optional().transform(emptyToNull),
  // Lists with planning only.
  planMode: z.enum(["plan", "suggest"]).optional(),
  roundIndex: z
    .union([z.coerce.number().int().min(0), z.literal("")])
    .optional()
    .transform((value) => (typeof value === "number" ? value : null)),
  // Only sent for a round that is already over.
  finished: z.enum(FINISHED_CHOICES).optional(),
});

export async function suggestEntryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const values = formValues(formData);
  const parsed = suggestSchema.safeParse(values);
  const media = readMediaToAdd(values);
  if (!parsed.success || !media.ok) return validationErrors([parsed.error, media.ok ? undefined : media.error]);
  if (media.items.length === 0) return { error: "Eklemek için en az bir öge seç." };
  const data = parsed.data;

  let result: BatchResult;
  try {
    result = await suggestEntries(user.id, {
      challengeId: data.challengeId,
      items: media.items,
      recipientId: data.recipientId,
      pitch: data.pitch,
      plan: data.planMode ? { mode: data.planMode, roundIndex: data.roundIndex } : undefined,
      finished: data.finished,
    });
  } catch (error) {
    return toActionState(error);
  }
  // Everything went in: back to the list, which points out what was added. Otherwise stay, so
  // the rest can be fixed or dropped.
  if (result.failed.length === 0) redirect(`/challenges/${data.challengeId}?added=${result.ids.join(",")}`);
  refresh();
  return batchState(result, (count) => `${count} öge eklendi.`);
}

export async function deleteEntryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const entryId = z.uuid().safeParse(formData.get("entryId"));
  if (!entryId.success) return { error: "Öge bulunamadı." };
  let challengeId: string;
  try {
    challengeId = await deleteEntry(user.id, entryId.data);
  } catch (error) {
    return toActionState(error);
  }
  redirect(`/challenges/${challengeId}?removed=${entryId.data}`);
}

/** Shared plumbing for small entry-level forms: auth, validation, error mapping, refresh. */
async function entryAction<T extends z.ZodType>(
  formData: FormData,
  schema: T,
  run: (userId: string, input: z.infer<T>) => Promise<void>,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = schema.safeParse(formValues(formData));
  // Small forms have no room for field messages, so the first problem becomes the message.
  if (!parsed.success) return validationError(parsed.error, parsed.error.issues[0]?.message);
  try {
    await run(user.id, parsed.data);
  } catch (error) {
    return toActionState(error);
  }
  refresh();
  return undefined;
}

export async function changeEntryStateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return entryAction(formData, z.object({ entryId: z.uuid(), stateId: z.uuid() }), (userId, input) =>
    changeEntryState(userId, input.entryId, input.stateId),
  );
}

const progressSchema = z.object({
  entryId: z.uuid(),
  status: z.enum(PROGRESS_STATUSES).optional(),
  // "0" clears the rating.
  rating: z.coerce.number().int().min(0).max(10).optional(),
});

export async function updateProgressAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return entryAction(formData, progressSchema, async (userId, input) => {
    await updateProgress(userId, input.entryId, {
      status: input.status,
      rating: input.rating === undefined ? undefined : input.rating === 0 ? null : input.rating,
    });
  });
}

/** One-tap "İzledim/Okudum" on a card; the previous status lets the notice offer "Geri al". */
export async function markProgressAction(
  entryId: string,
  status: ProgressStatus,
): Promise<{ error: string } | { previous: ProgressStatus | null }> {
  const user = await requireUser();
  if (!z.uuid().safeParse(entryId).success || !z.enum(PROGRESS_STATUSES).safeParse(status).success) {
    return { error: "Öge bulunamadı." };
  }
  try {
    const previous = await updateProgress(user.id, entryId, { status });
    refresh();
    return { previous };
  } catch (error) {
    return { error: toActionState(error)?.error ?? "Durum kaydedilemedi." };
  }
}

const noteSchema = z.object({
  entryId: z.uuid(),
  body: z.string().trim().min(1, "Boş not eklenemez.").max(5000, "En fazla 5000 karakter."),
  visibility: z.enum(["private", "shared"]),
  isSpoiler: z
    .string()
    .optional()
    .transform((value) => value === "on"),
});

export async function addNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return entryAction(formData, noteSchema, (userId, { entryId, ...input }) => addNote(userId, entryId, input));
}

export async function deleteNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return entryAction(formData, z.object({ noteId: z.uuid() }), (userId, input) => deleteNote(userId, input.noteId));
}

export async function toggleVoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return entryAction(formData, z.object({ entryId: z.uuid() }), (userId, input) => toggleVote(userId, input.entryId));
}

const placeSchema = z.object({
  entryId: z.uuid(),
  roundIndex: z.coerce.number({ error: "Bir tur seç." }).int().min(0, "Bir tur seç."),
  finished: z.enum(FINISHED_CHOICES).optional(),
});

export async function placeEntryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return entryAction(formData, placeSchema, (userId, input) => placeEntry(userId, input.entryId, input.roundIndex, input.finished));
}

export async function unplanEntryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return entryAction(formData, z.object({ entryId: z.uuid() }), (userId, input) => unplanEntry(userId, input.entryId));
}
