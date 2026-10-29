"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionState, validationError } from "@/lib/action-state";
import { formValues } from "@/lib/forms";
import { safeRedirectPath } from "@/lib/utils";
import { getAuth } from "./auth";
import { authErrorMessage } from "./messages";

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Adını yaz.").max(60, "En fazla 60 karakter."),
  username: z
    .string()
    .trim()
    .min(3, "En az 3 karakter.")
    .max(30, "En fazla 30 karakter.")
    .regex(/^[a-zA-Z0-9_.]+$/, "Yalnızca harf, rakam, nokta ve alt çizgi."),
  email: z.email("Geçerli bir e-posta adresi gir."),
  password: z.string().min(8, "Şifre en az 8 karakter olmalı.").max(128),
  registrationCode: z.string().optional(),
  next: z.string().optional(),
});

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(formValues(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { name, username, email, password, registrationCode, next } = parsed.data;

  const requiredCode = process.env.REGISTRATION_CODE;
  if (requiredCode && registrationCode?.trim() !== requiredCode) {
    return { error: "Kayıt kodu hatalı.", fieldErrors: { registrationCode: ["Kayıt kodu hatalı."] } };
  }

  try {
    await getAuth().api.signUpEmail({
      body: { name, username, email: email.toLowerCase(), password },
      headers: await headers(),
    });
  } catch (error) {
    if (isAPIError(error)) return { error: authErrorMessage({ code: error.body?.code, status: error.statusCode }) };
    throw error;
  }

  redirect(safeRedirectPath(next));
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Mevcut şifreni yaz."),
    newPassword: z.string().min(8, "Şifre en az 8 karakter olmalı.").max(128),
    repeatPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.repeatPassword, { path: ["repeatPassword"], message: "Şifreler aynı değil." });

/** Changing one's own password (also how a temporary one from the site admin gets replaced). */
export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = changePasswordSchema.safeParse(formValues(formData));
  if (!parsed.success) return validationError(parsed.error);
  try {
    await getAuth().api.changePassword({
      body: { currentPassword: parsed.data.currentPassword, newPassword: parsed.data.newPassword, revokeOtherSessions: true },
      headers: await headers(),
    });
  } catch (error) {
    if (isAPIError(error)) return { error: authErrorMessage({ code: error.body?.code, status: error.statusCode }) };
    throw error;
  }
  return { success: "Şifren değişti. Diğer cihazlardaki oturumların kapandı." };
}

export async function signOutAction(): Promise<void> {
  await getAuth().api.signOut({ headers: await headers() });
  redirect("/sign-in");
}
