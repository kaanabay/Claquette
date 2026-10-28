import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { boardNotes, users } from "@/db/schema";
import { canDeleteNote } from "./domain";
import type { BoardRef } from "./service";

const author = alias(users, "author");
const editor = alias(users, "editor");

/**
 * A board's notes, pinned first, newest first. The caller has already checked that the viewer
 * belongs to the group; `canManage` = list creator or group admin.
 */
export async function listBoardNotes(board: BoardRef, viewer: { id: string; canManage: boolean }) {
  const rows = await db
    .select({
      id: boardNotes.id,
      title: boardNotes.title,
      body: boardNotes.body,
      isPinned: boardNotes.isPinned,
      createdBy: boardNotes.createdBy,
      authorName: author.name,
      editorId: boardNotes.updatedBy,
      editorName: editor.name,
      createdAt: boardNotes.createdAt,
      updatedAt: boardNotes.updatedAt,
    })
    .from(boardNotes)
    .leftJoin(author, eq(author.id, boardNotes.createdBy))
    .leftJoin(editor, eq(editor.id, boardNotes.updatedBy))
    .where(
      and(
        "challengeId" in board
          ? eq(boardNotes.challengeId, board.challengeId)
          : and(eq(boardNotes.groupId, board.groupId), isNull(boardNotes.challengeId)),
        isNull(boardNotes.deletedAt),
      ),
    )
    .orderBy(desc(boardNotes.isPinned), desc(boardNotes.createdAt));

  return rows.map((row) => ({
    ...row,
    canDelete: canDeleteNote({ actorId: viewer.id, createdBy: row.createdBy, canManage: viewer.canManage }),
  }));
}

export type BoardNote = Awaited<ReturnType<typeof listBoardNotes>>[number];
