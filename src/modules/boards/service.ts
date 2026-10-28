import "server-only";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { boardNotes } from "@/db/schema";
import { AppError } from "@/lib/action-state";
import { isUuid } from "@/lib/utils";
import { logActivity } from "@/modules/activity/service";
import { requireChallengeAccess } from "@/modules/challenges/context";
import { isAdminRole, requireMembership } from "@/modules/groups/service";
import { canDeleteNote, RESTORE_WINDOW_MS, setLineChecked } from "./domain";

/** A shared list's board, or the group's own. */
export type BoardRef = { challengeId: string } | { groupId: string };

export type NoteInput = { title: string | null; body: string };

/** Everyone in the group may use a board; its managers (list creator, group admins) may also delete. */
async function requireBoard(userId: string, board: BoardRef) {
  if ("challengeId" in board) {
    const access = await requireChallengeAccess(board.challengeId, userId);
    return { groupId: access.challenge.groupId, challengeId: access.challenge.id, canManage: access.canManage };
  }
  if (!isUuid(board.groupId)) throw new AppError("Grup bulunamadı.");
  const membership = await requireMembership(board.groupId, userId);
  return { groupId: board.groupId, challengeId: null, canManage: isAdminRole(membership.role) };
}

async function requireNote(userId: string, noteId: string, { deleted = false } = {}) {
  if (!isUuid(noteId)) throw new AppError("Not bulunamadı.");
  const [note] = await db
    .select()
    .from(boardNotes)
    .where(and(eq(boardNotes.id, noteId), deleted ? undefined : isNull(boardNotes.deletedAt)))
    .limit(1);
  if (!note) throw new AppError("Not bulunamadı.");
  const board = await requireBoard(userId, note.challengeId ? { challengeId: note.challengeId } : { groupId: note.groupId });
  return { note, canManage: board.canManage };
}

export async function addBoardNote(userId: string, board: BoardRef, input: NoteInput): Promise<string> {
  const { groupId, challengeId } = await requireBoard(userId, board);
  return db.transaction(async (tx) => {
    const [note] = await tx
      .insert(boardNotes)
      .values({ groupId, challengeId, title: input.title, body: input.body, createdBy: userId, updatedBy: userId })
      .returning({ id: boardNotes.id });
    await logActivity(tx, {
      groupId,
      challengeId,
      actorId: userId,
      type: "board.note_added",
      data: { title: input.title ?? input.body.split("\n")[0]?.slice(0, 60) ?? null },
    });
    return note.id;
  });
}

/**
 * Saves an edit made on the version from `baseUpdatedAt`. If someone changed the note meanwhile
 * (even a tick), the save is refused instead of silently undoing their change.
 */
export async function updateBoardNote(userId: string, noteId: string, input: NoteInput, baseUpdatedAt: Date): Promise<void> {
  const { note } = await requireNote(userId, noteId);
  const saved = await db
    .update(boardNotes)
    .set({ title: input.title, body: input.body, updatedBy: userId })
    // Postgres keeps microseconds, a JS Date only milliseconds.
    .where(
      and(eq(boardNotes.id, note.id), sql`date_trunc('milliseconds', ${boardNotes.updatedAt}) = ${baseUpdatedAt.toISOString()}::timestamptz`),
    )
    .returning({ id: boardNotes.id });
  if (saved.length === 0) {
    throw new AppError("Bu not sen düzenlerken değişti. Yazdığını kaybetmemek için kopyala, sayfayı yenileyip tekrar düzenle.");
  }
}

/** Ticks one checklist line on the note as it is now, so two people ticking different lines don't clash. */
export async function setBoardNoteLine(userId: string, noteId: string, line: { index: number; text: string; checked: boolean }) {
  const { note } = await requireNote(userId, noteId);
  await db.transaction(async (tx) => {
    const [current] = await tx.select({ body: boardNotes.body }).from(boardNotes).where(eq(boardNotes.id, note.id)).for("update");
    const body = current ? setLineChecked(current.body, line.index, line.text, line.checked) : null;
    if (body === null) throw new AppError("Not bu arada değişmiş; güncel hâli yüklendi, tekrar dene.");
    await tx.update(boardNotes).set({ body, updatedBy: userId }).where(eq(boardNotes.id, note.id));
  });
}

export async function setBoardNotePinned(userId: string, noteId: string, pinned: boolean): Promise<void> {
  const { note } = await requireNote(userId, noteId);
  // Pinning moves a note, it doesn't change it: updated_at/by stay.
  await db.update(boardNotes).set({ isPinned: pinned, updatedAt: note.updatedAt }).where(eq(boardNotes.id, note.id));
}

/** Hides the note; `restoreBoardNote` can bring it back for a while. */
export async function deleteBoardNote(userId: string, noteId: string): Promise<void> {
  const { note, canManage } = await requireNote(userId, noteId);
  if (!canDeleteNote({ actorId: userId, createdBy: note.createdBy, canManage })) {
    throw new AppError("Bu notu yalnızca yazan kişi, listeyi kuran ya da grup yöneticileri silebilir.");
  }
  await db
    .update(boardNotes)
    .set({ deletedAt: new Date(), deletedBy: userId, updatedAt: note.updatedAt })
    .where(eq(boardNotes.id, note.id));
}

export async function restoreBoardNote(userId: string, noteId: string): Promise<void> {
  const { note } = await requireNote(userId, noteId, { deleted: true });
  const restored = await db
    .update(boardNotes)
    .set({ deletedAt: null, deletedBy: null, updatedAt: note.updatedAt })
    .where(
      and(
        eq(boardNotes.id, note.id),
        eq(boardNotes.deletedBy, userId),
        gt(boardNotes.deletedAt, new Date(Date.now() - RESTORE_WINDOW_MS)),
      ),
    )
    .returning({ id: boardNotes.id });
  if (restored.length === 0) throw new AppError("Bu not artık geri alınamıyor.");
}
