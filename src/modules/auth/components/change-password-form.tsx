"use client";

import { KeyRound } from "lucide-react";
import { ActionForm } from "@/components/ui/action-form";
import { Input, Label } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFieldId } from "@/components/ui/use-field-id";
import { changePasswordAction } from "../actions";

export function ChangePasswordForm() {
  const fid = useFieldId();
  return (
    <ActionForm action={changePasswordAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor={fid("current-password")}>Mevcut şifre</Label>
        <Input id={fid("current-password")} name="currentPassword" type="password" autoComplete="current-password" required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={fid("new-password")}>Yeni şifre</Label>
          <Input id={fid("new-password")} name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={fid("repeat-password")}>Yeni şifre (tekrar)</Label>
          <Input id={fid("repeat-password")} name="repeatPassword" type="password" autoComplete="new-password" minLength={8} required />
        </div>
      </div>
      <SubmitButton variant="outline" className="self-start">
        <KeyRound /> Şifreyi değiştir
      </SubmitButton>
    </ActionForm>
  );
}
