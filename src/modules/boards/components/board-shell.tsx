"use client";

import { Plus, StickyNote } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Fold, ShowMore } from "@/components/fold";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { highlight } from "@/components/ui/highlight";
import { EmptyState } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { toast } from "@/components/ui/toaster";
import { useFormAction } from "@/components/ui/use-form-action";
import { addBoardNoteAction } from "../actions";
import type { BoardRef } from "../service";
import { NoteFields } from "./note-fields";

/** The board's frame: title, "Not ekle" and its form, and the notes (rendered by the server) below. */
export function BoardShell({
  board,
  count,
  hint,
  children,
}: {
  board: BoardRef;
  count: number;
  hint: string;
  children: React.ReactNode;
}) {
  const [composing, setComposing] = useState(false);
  return (
    <Fold
      id="pano"
      remember="board-notes"
      forceOpen={composing}
      title={
        <>
          Pano <span className="font-normal text-muted-foreground">({count})</span>
        </>
      }
      action={
        composing ? null : (
          <Button variant="outline" size="sm" onClick={() => setComposing(true)}>
            <Plus /> Not ekle
          </Button>
        )
      }
    >
      <p className="mb-4 text-sm text-muted-foreground">{hint}</p>
      {composing ? <NoteComposer board={board} onClose={() => setComposing(false)} /> : null}
      {count > 0 ? (
        <ShowMore initial={6} className="columns-1 gap-3 sm:columns-2">
          {children}
        </ShowMore>
      ) : composing ? null : (
        <EmptyState icon={<StickyNote />} title="Pano boş">
          Aklınızdakileri buraya yazın: seçeceğiniz yönetmenler, bağlantılar, fikirler. Herkes ekleyip düzenleyebilir.
        </EmptyState>
      )}
    </Fold>
  );
}

function NoteComposer({ board, onClose }: { board: BoardRef; onClose: () => void }) {
  const { state, pending, formProps } = useFormAction(addBoardNoteAction);
  const [body, setBody] = useState("");
  const announced = useRef(state);

  useEffect(() => {
    if (!state?.success || announced.current === state) return;
    announced.current = state;
    toast(state.success);
    highlight(state.created ?? []);
    onClose();
  }, [state, onClose]);

  return (
    <form {...formProps} className="mb-4 flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs">
      {"challengeId" in board ? (
        <input type="hidden" name="challengeId" value={board.challengeId} />
      ) : (
        <input type="hidden" name="groupId" value={board.groupId} />
      )}
      <NoteFields defaultTitle="" body={body} onBodyChange={setBody} errors={state?.fieldErrors ?? {}} autoFocus />
      <FormMessage state={state?.error ? state : undefined} />
      <div className="flex gap-2">
        <SubmitButton pending={pending} size="sm">
          Panoya ekle
        </SubmitButton>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}
