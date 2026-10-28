"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionState, toActionState, validationError } from "@/lib/action-state";
import { TONES } from "@/lib/tones";
import { requireUser } from "@/modules/auth/session";
import { STATE_CATEGORIES } from "./domain";
import { createWorkflow } from "./service";

const stepSchema = z.object({
  label: z.string().trim().min(1, "Adım adı boş olamaz.").max(30, "Adım adı en fazla 30 karakter."),
  category: z.enum(STATE_CATEGORIES),
  color: z.enum(Object.keys(TONES) as [keyof typeof TONES, ...(keyof typeof TONES)[]]),
});

const workflowSchema = z.object({
  groupId: z.uuid(),
  name: z.string().trim().min(1, "Akışa bir isim ver.").max(60, "En fazla 60 karakter."),
  description: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => value || null),
  steps: z
    .string()
    .transform((value, ctx) => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "Adımlar okunamadı." });
        return z.NEVER;
      }
    })
    .pipe(z.array(stepSchema).min(2, "En az iki adım gerekli.").max(12, "En fazla 12 adım.")),
});

export async function createWorkflowAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = workflowSchema.safeParse({
    groupId: formData.get("groupId"),
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
    steps: formData.get("steps"),
  });
  if (!parsed.success) {
    const stepIssue = parsed.error.issues.find((issue) => issue.path[0] === "steps");
    return stepIssue ? { error: stepIssue.message } : validationError(parsed.error);
  }

  try {
    await createWorkflow(user.id, parsed.data.groupId, parsed.data);
  } catch (error) {
    return toActionState(error);
  }
  redirect(`/groups/${parsed.data.groupId}`);
}
