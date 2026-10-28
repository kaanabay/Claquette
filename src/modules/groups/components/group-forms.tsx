"use client";

import { LogIn, Plus } from "lucide-react";
import { useActionState } from "react";
import { Input, Label, Textarea } from "@/components/ui/fields";
import { FieldError, FormMessage } from "@/components/ui/form-message";
import { FreshAfterSubmit } from "@/components/ui/fresh-after-submit";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFieldId } from "@/components/ui/use-field-id";
import { createGroupAction, joinGroupAction } from "../actions";

export function CreateGroupForm() {
  return (
    <FreshAfterSubmit>
      <CreateGroupFormInner />
    </FreshAfterSubmit>
  );
}

function CreateGroupFormInner() {
  const [state, action] = useActionState(createGroupAction, undefined);
  const fid = useFieldId();
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor={fid("group-name")}>Grup adı</Label>
        <Input id={fid("group-name")} name="name" placeholder="ör. Pazar Sineması" required maxLength={60} />
        <FieldError errors={state?.fieldErrors?.name} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={fid("group-description")}>Açıklama (isteğe bağlı)</Label>
        <Textarea id={fid("group-description")} name="description" rows={2} maxLength={280} className="min-h-16" />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="self-start">
        <Plus /> Grup oluştur
      </SubmitButton>
    </form>
  );
}

export function JoinGroupForm(props: { defaultCode?: string }) {
  return (
    <FreshAfterSubmit>
      <JoinGroupFormInner {...props} />
    </FreshAfterSubmit>
  );
}

function JoinGroupFormInner({ defaultCode = "" }: { defaultCode?: string }) {
  const [state, action] = useActionState(joinGroupAction, undefined);
  const fid = useFieldId();
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor={fid("invite-code")}>Davet kodu</Label>
        <Input
          id={fid("invite-code")}
          name="code"
          defaultValue={defaultCode}
          placeholder="ör. K7M2QX9P"
          required
          autoComplete="off"
          className="font-mono uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal"
        />
        <FieldError errors={state?.fieldErrors?.code} />
      </div>
      <FormMessage state={state} />
      <SubmitButton variant="outline" className="self-start">
        <LogIn /> Gruba katıl
      </SubmitButton>
    </form>
  );
}
