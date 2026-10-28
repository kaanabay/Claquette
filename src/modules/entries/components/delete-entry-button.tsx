"use client";

import { Trash } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { deleteEntryAction } from "../actions";

/**
 * Deletes an item added by mistake, after an in-place confirmation (it takes everyone's notes,
 * ratings and votes with it, so there's no undo); then goes back to the list.
 */
export function DeleteEntryButton({ entryId, title }: { entryId: string; title: string }) {
  const [state, formAction, pending] = useActionState(deleteEntryAction, undefined);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" className="self-start text-destructive" onClick={() => setConfirming(true)}>
        <Trash /> Listeden sil
      </Button>
    );
  }
  return (
    <form action={formAction} className="flex flex-col items-start gap-3 rounded-lg bg-destructive/5 p-3 ring-1 ring-destructive/25 ring-inset">
      <input type="hidden" name="entryId" value={entryId} />
      <p className="text-sm">
        “{title}” listeden silinsin mi? Notları, puanları ve oyları da silinir; bu geri alınamaz.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="destructive" size="sm" disabled={pending}>
          <Trash /> Evet, sil
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
          Vazgeç
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
