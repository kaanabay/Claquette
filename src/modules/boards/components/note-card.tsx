"use client";

import { Pencil, Pin, PinOff, Trash } from "lucide-react";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { highlight } from "@/components/ui/highlight";
import { SubmitButton } from "@/components/ui/submit-button";
import { toast } from "@/components/ui/toaster";
import { useFormAction } from "@/components/ui/use-form-action";
import { cn } from "@/lib/utils";
import {
  deleteBoardNoteAction,
  restoreBoardNoteAction,
  setBoardNoteLineAction,
  setBoardNotePinnedAction,
  updateBoardNoteAction,
} from "../actions";
import { checklistCounts, linkify, type NoteLine, parseNote, setLineChecked } from "../domain";
import type { BoardNote } from "../queries";
import { NoteFields } from "./note-fields";

/** Lines shown before "Tümünü göster". */
const PREVIEW_LINES = 12;

/** `meta`: who wrote it and when, formatted on the server (no clock differences while hydrating). */
export function NoteCard({ note, meta }: { note: BoardNote; meta: string }) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hideDone, setHideDone] = useState(false);
  const [body, setOptimisticBody] = useOptimistic(note.body);
  const [pending, startTransition] = useTransition();

  if (editing) return <NoteEditor note={note} onDone={() => setEditing(false)} />;

  const lines = parseNote(body).map((line, index) => ({ line, index }));
  const counts = checklistCounts(lines.map((entry) => entry.line));
  const visible = hideDone ? lines.filter(({ line }) => !(line.kind === "check" && line.checked)) : lines;
  // Trailing blank lines say nothing.
  while (visible.length > 0 && !visible[visible.length - 1].line.text.trim()) visible.pop();
  const shown = expanded ? visible : visible.slice(0, PREVIEW_LINES);

  function tick(index: number, line: Extract<NoteLine, { kind: "check" }>) {
    startTransition(async () => {
      setOptimisticBody((current) => setLineChecked(current, index, line.text, !line.checked) ?? current);
      const result = await setBoardNoteLineAction({ noteId: note.id, index, text: line.text, checked: !line.checked });
      if (result?.error) toast(result.error, { isError: true });
    });
  }

  function pin() {
    startTransition(async () => {
      const result = await setBoardNotePinnedAction(note.id, !note.isPinned);
      if (result?.error) toast(result.error, { isError: true });
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteBoardNoteAction(note.id);
      if (result?.error) {
        toast(result.error, { isError: true });
        return;
      }
      toast(note.title ? `“${note.title}” notu silindi.` : "Not silindi.", {
        action: {
          label: "Geri al",
          onClick: async () => {
            const restored = await restoreBoardNoteAction(note.id);
            if (restored?.error) toast(restored.error, { isError: true });
            else highlight([note.id]);
          },
        },
      });
    });
  }

  return (
    <article
      data-highlight-id={note.id}
      className={cn("mb-3 flex break-inside-avoid flex-col gap-2 rounded-xl border bg-card p-4 shadow-xs", note.isPinned && "border-primary/60")}
    >
      {note.title || note.isPinned ? (
        <header className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 font-semibold leading-snug">{note.title}</h3>
          {note.isPinned ? (
            <span role="img" aria-label="Sabitlenmiş" className="mt-0.5 shrink-0 text-primary">
              <Pin className="size-4" />
            </span>
          ) : null}
        </header>
      ) : null}

      <ul className="flex flex-col gap-1 text-sm">
        {shown.map(({ line, index }) =>
          line.kind === "check" ? (
            <li key={index}>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={line.checked}
                  onChange={() => tick(index, line)}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                <span className={cn("min-w-0 break-words", line.checked && "text-muted-foreground line-through")}>
                  <LinkedText text={line.text} />
                </span>
              </label>
            </li>
          ) : line.text.trim() ? (
            <li key={index} className="break-words whitespace-pre-wrap">
              <LinkedText text={line.text} />
            </li>
          ) : (
            <li key={index} className="h-2" aria-hidden />
          ),
        )}
      </ul>
      {visible.length > shown.length ? (
        <button type="button" onClick={() => setExpanded(true)} className="self-start text-xs font-medium text-muted-foreground hover:text-foreground">
          Tümünü göster ({visible.length - shown.length} satır daha)
        </button>
      ) : null}

      <footer className="mt-1 flex items-center gap-1 border-t pt-2 text-xs text-muted-foreground">
        <span className="min-w-0 flex-1 truncate">{meta}</span>
        {counts.total > 0 ? (
          <button
            type="button"
            onClick={() => setHideDone((value) => !value)}
            className="shrink-0 rounded px-1.5 py-1 tabular-nums hover:bg-muted hover:text-foreground"
            title={hideDone ? "İşaretlileri göster" : "İşaretlileri gizle"}
          >
            ✓ {counts.done}/{counts.total}
            {hideDone ? " · gizli" : ""}
          </button>
        ) : null}
        <Button variant="ghost" size="icon" className="size-7" onClick={pin} disabled={pending} aria-label={note.isPinned ? "Sabitlemeyi kaldır" : "Sabitle"}>
          {note.isPinned ? <PinOff /> : <Pin />}
        </Button>
        <Button variant="ghost" size="icon" className="size-7" onClick={() => setEditing(true)} aria-label="Notu düzenle">
          <Pencil />
        </Button>
        {note.canDelete ? (
          <Button variant="ghost" size="icon" className="size-7 hover:text-destructive" onClick={remove} disabled={pending} aria-label="Notu sil">
            <Trash />
          </Button>
        ) : null}
      </footer>
    </article>
  );
}

function LinkedText({ text }: { text: string }) {
  return linkify(text).map((part, index) =>
    part.href ? (
      <a key={index} href={part.href} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2 break-all">
        {part.text}
      </a>
    ) : (
      part.text
    ),
  );
}

/**
 * Edits the note as it was when editing began (`base`). While the text is untouched it follows
 * changes from others (a tick, say); once typed in, saving over a newer version is refused.
 */
function NoteEditor({ note, onDone }: { note: BoardNote; onDone: () => void }) {
  const { state, pending, formProps } = useFormAction(updateBoardNoteAction);
  const [base, setBase] = useState({ body: note.body, updatedAt: note.updatedAt });
  const [body, setBody] = useState(note.body);
  const handled = useRef(state);

  if (note.updatedAt.getTime() !== base.updatedAt.getTime() && body === base.body) {
    setBase({ body: note.body, updatedAt: note.updatedAt });
    setBody(note.body);
  }

  useEffect(() => {
    if (!state?.success || handled.current === state) return;
    handled.current = state;
    onDone();
  }, [state, onDone]);

  return (
    <form {...formProps} className="mb-3 flex break-inside-avoid flex-col gap-3 rounded-xl border border-primary/60 bg-card p-4 shadow-xs">
      <input type="hidden" name="noteId" value={note.id} />
      <input type="hidden" name="baseUpdatedAt" value={base.updatedAt.toISOString()} />
      <NoteFields defaultTitle={note.title ?? ""} body={body} onBodyChange={setBody} errors={state?.fieldErrors ?? {}} />
      <FormMessage state={state?.error ? state : undefined} />
      <div className="flex gap-2">
        <SubmitButton pending={pending} size="sm">
          Kaydet
        </SubmitButton>
        <Button variant="ghost" size="sm" onClick={onDone}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}
