"use client";

import { Crown, Save, ShieldCheck, ShieldOff, UserMinus } from "lucide-react";
import { useActionState, useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/fields";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFieldId } from "@/components/ui/use-field-id";
import { removeMemberAction, setMemberRoleAction, updateGroupAction } from "../actions";
import type { GroupSettingsData } from "../queries";

export function GroupInfoForm({ group }: { group: GroupSettingsData["group"] }) {
  const fid = useFieldId();
  return (
    <ActionForm action={updateGroupAction} className="flex flex-col gap-3">
      <input type="hidden" name="groupId" value={group.id} />
      <div className="flex flex-col gap-2">
        <Label htmlFor={fid("group-name")}>Grup adı</Label>
        <Input id={fid("group-name")} name="name" defaultValue={group.name} required maxLength={60} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={fid("group-description")}>Açıklama (isteğe bağlı)</Label>
        <Textarea id={fid("group-description")} name="description" defaultValue={group.description ?? ""} rows={2} maxLength={280} />
      </div>
      <SubmitButton className="self-start">
        <Save /> Kaydet
      </SubmitButton>
    </ActionForm>
  );
}

export function MemberRow({ groupId, member }: { groupId: string; member: GroupSettingsData["members"][number] }) {
  return (
    <li className="flex flex-col gap-2 border-b py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="flex min-w-0 items-center gap-3 text-sm">
        <Avatar name={member.name} seed={member.userId} />
        <span className="min-w-0">
          <span className="block truncate font-medium">
            {member.name}
            {member.isViewer ? <span className="font-normal text-muted-foreground"> (sen)</span> : null}
          </span>
          {member.username ? <span className="block text-xs text-muted-foreground">@{member.username}</span> : null}
        </span>
        {member.role === "owner" ? (
          <Badge>
            <Crown /> Kurucu
          </Badge>
        ) : member.role === "admin" ? (
          <Badge>Yönetici</Badge>
        ) : null}
      </span>
      {member.canManage ? <MemberActions groupId={groupId} member={member} /> : null}
    </li>
  );
}

function MemberActions({ groupId, member }: { groupId: string; member: GroupSettingsData["members"][number] }) {
  const [confirming, setConfirming] = useState(false);
  const [state, removeAction, removing] = useActionState(removeMemberAction, undefined);
  const hidden = (
    <>
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="memberId" value={member.userId} />
    </>
  );

  if (confirming) {
    return (
      <form action={removeAction} className="flex flex-col items-start gap-2 rounded-lg bg-destructive/5 p-3 ring-1 ring-destructive/25 ring-inset sm:max-w-sm">
        {hidden}
        <p className="text-sm">
          {member.name} gruptan çıkarılsın mı? Listelerden de ayrılır; eklediği ögeler, notları ve işaretleri kalır. Davet koduyla
          yeniden katılabilir.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="destructive" size="sm" disabled={removing}>
            <UserMinus /> Evet, çıkar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={removing}>
            Vazgeç
          </Button>
        </div>
        <FormMessage state={state} />
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <ActionForm action={setMemberRoleAction} messageClassName="text-xs">
        {hidden}
        {member.role === "admin" ? (
          <SubmitButton name="role" value="member" variant="ghost" size="sm">
            <ShieldOff /> Yöneticiliği kaldır
          </SubmitButton>
        ) : (
          <SubmitButton name="role" value="admin" variant="ghost" size="sm">
            <ShieldCheck /> Yönetici yap
          </SubmitButton>
        )}
      </ActionForm>
      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirming(true)}>
        <UserMinus /> Gruptan çıkar
      </Button>
    </div>
  );
}
