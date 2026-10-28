"use client";

import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input, Label, Textarea } from "@/components/ui/fields";
import { FieldError, FormMessage } from "@/components/ui/form-message";
import { FreshAfterSubmit } from "@/components/ui/fresh-after-submit";
import { highlight } from "@/components/ui/highlight";
import { SubmitButton } from "@/components/ui/submit-button";
import { toast } from "@/components/ui/toaster";
import { useFieldId } from "@/components/ui/use-field-id";
import { useFormAction } from "@/components/ui/use-form-action";
import { toDayValue } from "@/lib/short-date";
import { cn } from "@/lib/utils";
import { MediaPicker, useBasket } from "@/modules/media/components/media-picker";
import type { ExistingMedia } from "@/modules/media/keys";
import type { MediaTypeOption } from "@/modules/media/types";
import { addListItemAction } from "../actions";

type Props = { listId: string; mediaTypes: MediaTypeOption[]; existing: ExistingMedia };

export function AddListItemForm(props: Props) {
  return (
    <FreshAfterSubmit>
      <AddListItemFormInner {...props} />
    </FreshAfterSubmit>
  );
}

function AddListItemFormInner({ listId, mediaTypes, existing }: Props) {
  const { state, pending, formProps } = useFormAction(addListItemAction);
  const [picked, setPicked] = useBasket(existing);
  const [manualFilled, setManualFilled] = useState(false);
  const [manualKey, setManualKey] = useState(0);
  const [round, setRound] = useState(0);
  const [handled, setHandled] = useState(state);
  const announced = useRef(state);
  const fid = useFieldId();

  // Announce a clean run and point out the new rows. Once: effects run again when a hidden route
  // is shown again.
  useEffect(() => {
    if (!state?.success || announced.current === state) return;
    announced.current = state;
    toast(state.success);
    highlight(state.created ?? []);
  }, [state]);

  // Drop what went in. After a clean run start over with an empty picker; after a partial one
  // keep the failed items, so they can be fixed or dropped.
  if (state !== handled) {
    setHandled(state);
    const added = state?.added ?? [];
    if (added.length > 0) setPicked((current) => current.filter((item) => !added.includes(item.key)));
    if (state?.success) setRound((value) => value + 1);
    else if (added.includes("manual")) setManualKey((value) => value + 1);
  }

  const count = picked.length + (manualFilled ? 1 : 0);
  return (
    <form {...formProps} className="flex flex-col gap-4">
      <input type="hidden" name="listId" value={listId} />
      <MediaPicker
        key={`picker-${round}`}
        mediaTypes={mediaTypes}
        errors={state?.fieldErrors ?? {}}
        picked={picked}
        onPickedChange={setPicked}
        onManualChange={setManualFilled}
        existing={existing}
        manualKey={manualKey}
      />
      <div className={cn("flex flex-col gap-2", count > 1 && "hidden")}>
        <Textarea
          key={`note-${round}`}
          name="note"
          rows={2}
          maxLength={500}
          disabled={count > 1}
          placeholder="Not (isteğe bağlı) — ör. neden bu listede?"
          className="min-h-16"
          aria-label="Not"
        />
        <FieldError errors={state?.fieldErrors?.note} />
      </div>
      {count > 1 ? <p className="text-xs text-muted-foreground">Birden çok öge eklerken not yazılmaz; notları sonra listedeki ögelere ekleyebilirsin.</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={fid("addedOn")} className="text-sm font-normal text-muted-foreground">
          Tarih
        </Label>
        <Input
          key={`day-${round}`}
          id={fid("addedOn")}
          name="addedOn"
          type="date"
          max={toDayValue(new Date())}
          className="h-8 w-auto"
          aria-describedby={fid("addedOnHint")}
        />
        <span id={fid("addedOnHint")} className="text-xs text-muted-foreground">
          Boş bırakırsan bugün. Geçmişte izlediğini eklerken o günü seç.
        </span>
        <FieldError errors={state?.fieldErrors?.addedOn} />
      </div>
      {/* On phones the button stays in reach while picks are waiting. */}
      <div className={cn("flex flex-col gap-3", count > 0 && "max-sm:sticky max-sm:bottom-0 max-sm:z-20 max-sm:-mx-5 max-sm:border-t max-sm:bg-card/95 max-sm:px-5 max-sm:py-3 max-sm:backdrop-blur")}>
        <FormMessage state={state?.error ? state : undefined} />
        <SubmitButton pending={pending} disabled={count === 0} className="self-start max-sm:self-stretch">
          <Plus /> {count > 1 ? `${count} ögeyi listeye ekle` : "Listeye ekle"}
        </SubmitButton>
      </div>
    </form>
  );
}
