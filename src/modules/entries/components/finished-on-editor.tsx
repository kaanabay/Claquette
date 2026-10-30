"use client";

import { CalendarDays } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/fields";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionState } from "@/lib/action-state";
import { formatShortDate, toDayValue } from "@/lib/short-date";
import { setFinishedOnAction } from "../actions";

/** The day the viewer finished an item (the day they marked it, unless they say otherwise). */
export function FinishedOnEditor({ entryId, completedAt }: { entryId: string; completedAt: Date | null }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await setFinishedOnAction(previous, formData);
    if (!result?.error) setEditing(false);
    return result;
  }, undefined);
  const day = completedAt ?? new Date();

  if (!editing) {
    return (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="text-muted-foreground">Bitirdiğin gün:</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Günü değiştir"
          className="flex items-center gap-1 font-medium underline-offset-4 hover:underline"
        >
          <CalendarDays className="size-3.5" /> {formatShortDate(day)}
        </button>
      </p>
    );
  }
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="entryId" value={entryId} />
      <Input type="date" name="day" defaultValue={toDayValue(day)} max={toDayValue(new Date())} required aria-label="Bitirdiğin gün" className="h-8 w-auto" />
      <SubmitButton size="sm">Kaydet</SubmitButton>
      <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
        Vazgeç
      </Button>
      <FormMessage state={state} className="text-xs" />
    </form>
  );
}
