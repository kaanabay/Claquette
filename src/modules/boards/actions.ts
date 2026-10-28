"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { type ActionState, toActionState, validationError } from "@/lib/action-state";
import { formValues } from "@/lib/forms";
import { requireUser } from "@/modules/auth/session";
import {
  addBoardNote,
  type BoardRef,
  deleteBoardNote,
  restoreBoardNote,
  setBoardNoteLine,
  setBoardNotePinned,
  updateBoardNote,
} from "./service";

const noteFields = z
  .object({
    title: z
      .string()
      .trim()
      .max(120, "En fazla 120 karakter.")
      .optional()
      .transform((value) => value || null),
    // Long enough for a pasted list of a few hundred lines. Forms send line breaks as CRLF.
    body: z
      .string()
      .max(20000, "En fazla 20.000 karakter.")
      .optional()
      .transform((value) => (value ?? "").replace(/\r\n?/g, "\n").replace(/\s+$/, "")),
  })
  .refine((note) => note.title || note.body.trim(), { message: "Bir başlık ya da not yaz.", path: ["body"] });

const boardSchema = z.union([z.object({ challengeId: z.uuid() }), z.object({ groupId: z.uuid() })]);

export async function addBoardNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const values = formValues(formData);
  const parsed = noteFields.safeParse(values);
  if (!parsed.success) return validationError(parsed.error);
  const board = boardSchema.safeParse(values.challengeId ? { challengeId: values.challengeId } : { groupId: values.groupId });
  if (!board.success) return { error: "Pano bulunamadı." };
  let id: string;
  try {
    id = await addBoardNote(user.id, board.data as BoardRef, parsed.data);
  } catch (error) {
    return toActionState(error);
  }
  refresh();
  return { success: "Not panoya eklendi.", created: [id] };
}

export async function updateBoardNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const values = formValues(formData);
  const parsed = noteFields.safeParse(values);
  if (!parsed.success) return validationError(parsed.error);
  const noteId = z.uuid().safeParse(values.noteId);
  const base = z.coerce.date().safeParse(values.baseUpdatedAt);
  if (!noteId.success || !base.success) return { error: "Not bulunamadı." };
  try {
    await updateBoardNote(user.id, noteId.data, parsed.data, base.data);
  } catch (error) {
    return toActionState(error);
  }
  refresh();
  return { success: "Kaydedildi." };
}

const lineSchema = z.object({ noteId: z.uuid(), index: z.number().int().min(0), text: z.string().max(20000), checked: z.boolean() });

/** Called directly when a checkbox is clicked. */
export async function setBoardNoteLineAction(input: { noteId: string; index: number; text: string; checked: boolean }): Promise<ActionState> {
  const user = await requireUser();
  const parsed = lineSchema.safeParse(input);
  if (!parsed.success) return { error: "İşaretlenemedi." };
  try {
    await setBoardNoteLine(user.id, parsed.data.noteId, parsed.data);
  } catch (error) {
    refresh(); // show the note as it is now
    return toActionState(error);
  }
  refresh();
  return undefined;
}

export async function setBoardNotePinnedAction(noteId: string, pinned: boolean): Promise<ActionState> {
  const user = await requireUser();
  if (!z.uuid().safeParse(noteId).success) return { error: "Not bulunamadı." };
  try {
    await setBoardNotePinned(user.id, noteId, pinned);
  } catch (error) {
    return toActionState(error);
  }
  refresh();
  return undefined;
}

export async function deleteBoardNoteAction(noteId: string): Promise<ActionState> {
  const user = await requireUser();
  if (!z.uuid().safeParse(noteId).success) return { error: "Not bulunamadı." };
  try {
    await deleteBoardNote(user.id, noteId);
  } catch (error) {
    return toActionState(error);
  }
  refresh();
  return undefined;
}

export async function restoreBoardNoteAction(noteId: string): Promise<ActionState> {
  const user = await requireUser();
  if (!z.uuid().safeParse(noteId).success) return { error: "Not bulunamadı." };
  try {
    await restoreBoardNote(user.id, noteId);
  } catch (error) {
    return toActionState(error);
  }
  refresh();
  return undefined;
}
