"use server";

import { z } from "zod";
import { toActionState } from "@/lib/action-state";
import { requireUser } from "@/modules/auth/session";
import { resetPassword } from "./service";

/** Called from the admin page; the temporary password comes back to be shown once. */
export async function resetPasswordAction(userId: string): Promise<{ error: string } | { name: string; password: string }> {
  const admin = await requireUser();
  if (!z.string().min(1).max(64).safeParse(userId).success) return { error: "Kullanıcı bulunamadı." };
  try {
    return await resetPassword(admin.id, userId);
  } catch (error) {
    return { error: toActionState(error)?.error ?? "Şifre sıfırlanamadı." };
  }
}
