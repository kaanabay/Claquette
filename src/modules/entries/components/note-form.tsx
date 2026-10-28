"use client";

import { useActionState } from "react";
import { Checkbox, Textarea } from "@/components/ui/fields";
import { FormMessage } from "@/components/ui/form-message";
import { FreshAfterSubmit } from "@/components/ui/fresh-after-submit";
import { SubmitButton } from "@/components/ui/submit-button";
import { addNoteAction } from "../actions";

// Uses the plain form action on purpose: React clears the textarea after a successful post.
export function NoteForm(props: { entryId: string }) {
  return (
    <FreshAfterSubmit>
      <NoteFormInner {...props} />
    </FreshAfterSubmit>
  );
}

function NoteFormInner({ entryId }: { entryId: string }) {
  const [state, action] = useActionState(addNoteAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl border border-dashed p-3">
      <input type="hidden" name="entryId" value={entryId} />
      <Textarea name="body" rows={3} required maxLength={5000} placeholder="Notun, yorumun, en sevdiğin sahne…" aria-label="Not" />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" name="visibility" value="shared" defaultChecked className="accent-primary" /> Grupla paylaş
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="visibility" value="private" className="accent-primary" /> Kişisel not (sadece ben)
        </label>
        <label className="flex items-center gap-2">
          <Checkbox name="isSpoiler" /> Spoiler içeriyor
        </label>
        <SubmitButton size="sm" className="ml-auto">
          Not ekle
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
