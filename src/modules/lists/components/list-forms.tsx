"use client";

import { Globe, ListPlus, Lock, Save, Trash } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Textarea } from "@/components/ui/fields";
import { FieldError, FormMessage } from "@/components/ui/form-message";
import { FreshAfterSubmit } from "@/components/ui/fresh-after-submit";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFieldId } from "@/components/ui/use-field-id";
import { useFormAction } from "@/components/ui/use-form-action";
import { createListAction, deleteListAction, updateListAction } from "../actions";

type ListValues = { title: string; description: string | null; visibility: "private" | "public"; isRanked: boolean };

const pill =
  "flex flex-1 cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-sm transition-colors hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring";

/** Title, description, visibility and ranking: shared by "create" and "settings". */
function ListFields({ values, errors }: { values?: ListValues; errors: Record<string, string[] | undefined> }) {
  const fid = useFieldId();
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor={fid("title")}>Ad</Label>
        <Input id={fid("title")} name="title" required maxLength={80} defaultValue={values?.title} placeholder="ör. 2026 Top 10, İzlenecekler" />
        <FieldError errors={errors.title} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={fid("description")}>Açıklama (isteğe bağlı)</Label>
        <Textarea id={fid("description")} name="description" rows={2} maxLength={500} defaultValue={values?.description ?? ""} />
        <FieldError errors={errors.description} />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Kimler görebilir?</legend>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className={pill}>
            <input type="radio" name="visibility" value="private" defaultChecked={(values?.visibility ?? "private") === "private"} className="sr-only" />
            <Lock className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="block font-medium">Gizli</span>
              <span className="block text-xs text-muted-foreground">Yalnızca sen.</span>
            </span>
          </label>
          <label className={pill}>
            <input type="radio" name="visibility" value="public" defaultChecked={values?.visibility === "public"} className="sr-only" />
            <Globe className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="block font-medium">Herkese açık</span>
              <span className="block text-xs text-muted-foreground">Linki olan herkes, giriş yapmadan.</span>
            </span>
          </label>
        </div>
        <FieldError errors={errors.visibility} />
      </fieldset>
      <label className="flex items-start gap-2 text-sm">
        <Checkbox name="isRanked" defaultChecked={values?.isRanked ?? false} className="mt-0.5" />
        <span>
          Sıralı liste
          <span className="block text-xs text-muted-foreground">Ögeler numaralı görünür (Top 10 gibi). Sırayı sürükleyerek değiştirirsin.</span>
        </span>
      </label>
    </>
  );
}

export function CreateListForm() {
  return (
    <FreshAfterSubmit>
      <CreateListFormInner />
    </FreshAfterSubmit>
  );
}

function CreateListFormInner() {
  const { state, pending, formProps } = useFormAction(createListAction);
  return (
    <form {...formProps} className="flex flex-col gap-4">
      <ListFields errors={state?.fieldErrors ?? {}} />
      <FormMessage state={state} />
      <SubmitButton pending={pending} className="self-start">
        <ListPlus /> Listeyi oluştur
      </SubmitButton>
    </form>
  );
}

export function ListSettingsForm({ listId, values }: { listId: string; values: ListValues }) {
  const { state, pending, formProps } = useFormAction(updateListAction);
  return (
    <form {...formProps} className="flex flex-col gap-4">
      <input type="hidden" name="listId" value={listId} />
      <ListFields values={values} errors={state?.fieldErrors ?? {}} />
      <FormMessage state={state} />
      <SubmitButton pending={pending} variant="outline" className="self-start">
        <Save /> Kaydet
      </SubmitButton>
    </form>
  );
}

export function DeleteListButton({ listId, title }: { listId: string; title: string }) {
  const [state, formAction, pending] = useActionState(deleteListAction, undefined);
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(`“${title}” listesi silinsin mi? Bu geri alınamaz.`)) event.preventDefault();
      }}
      className="flex flex-col items-start gap-2"
    >
      <input type="hidden" name="listId" value={listId} />
      <Button type="submit" variant="ghost" size="sm" className="text-destructive" disabled={pending}>
        <Trash /> Listeyi sil
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
