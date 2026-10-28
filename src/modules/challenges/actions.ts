"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionState, toActionState, validationError } from "@/lib/action-state";
import { formList, formValues } from "@/lib/forms";
import { requireUser } from "@/modules/auth/session";
import { CADENCE_PRESETS, CADENCE_UNITS } from "./domain/cadence";
import { configFieldName, getStrategy, readConfigFromForm, STRATEGY_KEYS } from "./domain/strategies";
import {
  advanceTurn,
  createChallenge,
  drawFromPool,
  joinChallenge,
  leaveChallenge,
  selectPoolEntry,
  setChallengeStatus,
} from "./service";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `En fazla ${max} karakter.`)
    .optional()
    .transform((value) => value || null);

const createChallengeSchema = z
  .object({
    groupId: z.uuid(),
    title: z.string().trim().min(1, "Listeye bir başlık ver.").max(80, "En fazla 80 karakter."),
    description: optionalText(500),
    cadencePreset: z.enum(["custom", ...CADENCE_PRESETS.map((preset) => preset.key)]),
    cadenceUnit: z.enum(CADENCE_UNITS).optional(),
    cadenceInterval: z.coerce.number().int().min(1, "En az 1.").max(365, "En fazla 365.").optional(),
    startsOn: z.iso.date("Geçerli bir başlangıç tarihi seç."),
    endsOn: z
      .union([z.iso.date("Geçerli bir tarih seç."), z.literal("")])
      .optional()
      .transform((value) => value || null),
    strategy: z.enum(STRATEGY_KEYS, "Bir öneri kuralı seç."),
    workflowId: z
      .union([z.uuid(), z.literal("")])
      .optional()
      .transform((value) => value || null),
    shuffle: z
      .string()
      .optional()
      .transform((value) => value === "on"),
  })
  .refine((data) => !data.endsOn || data.endsOn >= data.startsOn, {
    path: ["endsOn"],
    message: "Bitiş tarihi başlangıçtan önce olamaz.",
  });

export async function createChallengeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = createChallengeSchema.safeParse(formValues(formData));
  if (!parsed.success) return validationError(parsed.error);
  const data = parsed.data;

  const preset = CADENCE_PRESETS.find((p) => p.key === data.cadencePreset);
  const cadence = preset
    ? { unit: preset.unit, interval: preset.interval }
    : { unit: data.cadenceUnit ?? "week", interval: data.cadenceInterval ?? 1 };

  // Strategy options are validated by the strategy's own schema.
  const strategy = getStrategy(data.strategy);
  const config = strategy.configSchema.safeParse(readConfigFromForm(strategy, formData));
  if (!config.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of config.error.issues) {
      fieldErrors[configFieldName(strategy.key, String(issue.path[0]))] = [issue.message];
    }
    return { error: "Kural ayarlarını kontrol et.", fieldErrors };
  }

  const participantIds = formList(formData, "participants");
  if (participantIds.length === 0) {
    return { error: "En az bir katılımcı seç.", fieldErrors: { participants: ["En az bir katılımcı seç."] } };
  }

  let challengeId: string;
  try {
    challengeId = await createChallenge(user.id, {
      groupId: data.groupId,
      title: data.title,
      description: data.description,
      mediaTypes: formList(formData, "mediaTypes"),
      cadenceUnit: cadence.unit,
      cadenceInterval: cadence.interval,
      startsOn: data.startsOn,
      endsOn: data.endsOn,
      strategy: strategy.key,
      strategyConfig: config.data,
      workflowId: data.workflowId,
      participantIds,
      shuffle: data.shuffle,
    });
  } catch (error) {
    return toActionState(error);
  }
  redirect(`/challenges/${challengeId}`);
}

const challengeIdSchema = z.object({ challengeId: z.uuid() });

/** Shared plumbing for the small button actions on the challenge page. */
async function challengeAction(
  formData: FormData,
  run: (userId: string, challengeId: string) => Promise<string | void>,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = challengeIdSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: "Liste bulunamadı." };
  let success: string | void;
  try {
    success = await run(user.id, parsed.data.challengeId);
  } catch (error) {
    return toActionState(error);
  }
  refresh();
  return success ? { success } : undefined;
}

export async function joinChallengeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return challengeAction(formData, joinChallenge);
}

export async function leaveChallengeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return challengeAction(formData, leaveChallenge);
}

export async function advanceTurnAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return challengeAction(formData, advanceTurn);
}

export async function drawFromPoolAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return challengeAction(formData, async (userId, challengeId) => {
    const picked = await drawFromPool(userId, challengeId);
    return picked === 1 ? "Havuzdan bir öge seçildi." : `Havuzdan ${picked} öge seçildi.`;
  });
}

const statusSchema = z.enum(["active", "paused", "archived"]);

export async function setChallengeStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const status = statusSchema.safeParse(formData.get("status"));
  if (!status.success) return { error: "Geçersiz durum." };
  return challengeAction(formData, (userId, challengeId) => setChallengeStatus(userId, challengeId, status.data));
}

export async function selectPoolEntryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const entryId = z.uuid().safeParse(formData.get("entryId"));
  if (!entryId.success) return { error: "Öge bulunamadı." };
  try {
    await selectPoolEntry(user.id, entryId.data);
  } catch (error) {
    return toActionState(error);
  }
  refresh();
  return undefined;
}
