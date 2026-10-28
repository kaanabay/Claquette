import { timeAgo } from "@/lib/dates";
import type { BoardNote } from "../queries";
import type { BoardRef } from "../service";
import { BoardShell } from "./board-shell";
import { NoteCard } from "./note-card";

/** "Pano": notes kept next to a shared list or a group, which everyone in the group can edit. */
export function Board({ notes, board, hint }: { notes: BoardNote[]; board: BoardRef; hint: string }) {
  return (
    <BoardShell board={board} count={notes.length} hint={hint}>
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} meta={describeNote(note)} />
      ))}
    </BoardShell>
  );
}

function describeNote(note: BoardNote): string {
  const written = `${note.authorName ?? "Silinmiş kullanıcı"} · ${timeAgo(note.createdAt)}`;
  const edited = note.updatedAt.getTime() - note.createdAt.getTime() > 60_000;
  if (!edited) return written;
  const by = note.editorId && note.editorId !== note.createdBy ? `${note.editorName ?? "biri"} ` : "";
  return `${written} · ${by}düzenledi ${timeAgo(note.updatedAt)}`;
}
