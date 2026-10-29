"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionState, toActionState, validationError } from "@/lib/action-state";
import { formValues } from "@/lib/forms";
import { requireUser } from "@/modules/auth/session";
import { createGroup, joinGroupByCode, regenerateInviteCode, removeMember, setMemberRole, updateGroup } from "./service";

const groupSchema = z.object({
  name: z.string().trim().min(1, "Grubuna bir isim ver.").max(60, "En fazla 60 karakter."),
  description: z
    .string()
    .trim()
    .max(280, "En fazla 280 karakter.")
    .optional()
    .transform((value) => value || null),
});

export async function createGroupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = groupSchema.safeParse(formValues(formData));
  if (!parsed.success) return validationError(parsed.error);

  let groupId: string;
  try {
    groupId = await createGroup(user.id, parsed.data);
  } catch (error) {
    return toActionState(error);
  }
  redirect(`/groups/${groupId}`);
}

const joinSchema = z.object({
  code: z
    .string()
    .trim()
    .min(4, "Davet kodunu yaz.")
    .max(32)
    .regex(/^[a-zA-Z0-9]+$/, "Davet kodu yalnızca harf ve rakamlardan oluşur."),
});

export async function joinGroupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = joinSchema.safeParse(formValues(formData));
  if (!parsed.success) return validationError(parsed.error);

  let groupId: string;
  try {
    groupId = await joinGroupByCode(user.id, parsed.data.code);
  } catch (error) {
    return toActionState(error);
  }
  redirect(`/groups/${groupId}`);
}

export async function regenerateInviteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const groupId = z.uuid().safeParse(formData.get("groupId"));
  if (!groupId.success) return { error: "Grup bulunamadı." };
  try {
    await regenerateInviteCode(user.id, groupId.data);
  } catch (error) {
    return toActionState(error);
  }
  refresh();
  return { success: "Yeni davet kodu oluşturuldu; eski kod artık çalışmaz." };
}

export async function updateGroupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const groupId = z.uuid().safeParse(formData.get("groupId"));
  if (!groupId.success) return { error: "Grup bulunamadı." };
  const parsed = groupSchema.safeParse(formValues(formData));
  if (!parsed.success) return validationError(parsed.error);
  try {
    await updateGroup(user.id, groupId.data, parsed.data);
  } catch (error) {
    return toActionState(error);
  }
  refresh();
  return { success: "Grup bilgileri kaydedildi." };
}

const memberSchema = z.object({ groupId: z.uuid(), memberId: z.string().min(1) });

export async function setMemberRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = memberSchema.extend({ role: z.enum(["admin", "member"]) }).safeParse(formValues(formData));
  if (!parsed.success) return { error: "Üye bulunamadı." };
  try {
    await setMemberRole(user.id, parsed.data.groupId, parsed.data.memberId, parsed.data.role);
  } catch (error) {
    return toActionState(error);
  }
  refresh();
  return undefined;
}

export async function removeMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = memberSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: "Üye bulunamadı." };
  try {
    await removeMember(user.id, parsed.data.groupId, parsed.data.memberId);
  } catch (error) {
    return toActionState(error);
  }
  refresh();
  return undefined;
}
