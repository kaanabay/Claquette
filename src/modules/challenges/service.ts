import "server-only";
import { and, eq, inArray, max } from "drizzle-orm";
import { db } from "@/db";
import { challengeParticipants, challenges, entries, groupMembers, mediaTypes, workflows } from "@/db/schema";
import { AppError } from "@/lib/action-state";
import { logActivity } from "@/modules/activity/service";
import { settleEntries } from "@/modules/entries/settle";
import { requireMembership } from "@/modules/groups/service";
import { getDefaultWorkflowId } from "@/modules/workflows/queries";
import { requireChallengeAccess } from "./context";
import type { CadenceUnit } from "./domain/cadence";
import { getStrategy, parseStoredConfig } from "./domain/strategies";
import { drawForRound, selectIntoRound } from "./pool";
import { getCurrentRound, startNextTurn } from "./rounds";

export type CreateChallengeInput = {
  groupId: string;
  title: string;
  description: string | null;
  mediaTypes: string[];
  cadenceUnit: CadenceUnit;
  cadenceInterval: number;
  startsOn: string;
  endsOn: string | null;
  strategy: string;
  strategyConfig: Record<string, unknown>;
  workflowId: string | null;
  participantIds: string[];
  shuffle: boolean;
};

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function createChallenge(userId: string, input: CreateChallengeInput): Promise<string> {
  await requireMembership(input.groupId, userId);
  const strategy = getStrategy(input.strategy);
  const strategyConfig = strategy.configSchema.parse(input.strategyConfig);

  const members = await db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, input.groupId));
  const memberIds = new Set(members.map((member) => member.userId));
  let participantIds = [...new Set(input.participantIds)].filter((id) => memberIds.has(id));
  if (participantIds.length === 0) throw new AppError("En az bir katılımcı seç.");
  if (input.shuffle) participantIds = shuffled(participantIds);

  const knownTypes = input.mediaTypes.length
    ? await db.select({ slug: mediaTypes.slug }).from(mediaTypes).where(inArray(mediaTypes.slug, input.mediaTypes))
    : [];

  let workflowId = await getDefaultWorkflowId();
  if (input.workflowId) {
    const [workflow] = await db
      .select({ id: workflows.id, groupId: workflows.groupId })
      .from(workflows)
      .where(eq(workflows.id, input.workflowId))
      .limit(1);
    if (!workflow || (workflow.groupId !== null && workflow.groupId !== input.groupId)) {
      throw new AppError("Seçilen durum akışı bu grupta kullanılamaz.");
    }
    workflowId = workflow.id;
  }

  return db.transaction(async (tx) => {
    const [challenge] = await tx
      .insert(challenges)
      .values({
        groupId: input.groupId,
        title: input.title,
        description: input.description,
        mediaTypes: knownTypes.map((type) => type.slug),
        cadenceUnit: input.cadenceUnit,
        cadenceInterval: input.cadenceUnit === "none" ? 1 : input.cadenceInterval,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        strategy: strategy.key,
        strategyConfig,
        workflowId,
        createdBy: userId,
      })
      .returning({ id: challenges.id });

    await tx
      .insert(challengeParticipants)
      .values(participantIds.map((participantId, position) => ({ challengeId: challenge.id, userId: participantId, position })));

    await logActivity(tx, {
      groupId: input.groupId,
      challengeId: challenge.id,
      actorId: userId,
      type: "challenge.created",
      data: { title: input.title },
    });
    return challenge.id;
  });
}

export async function joinChallenge(userId: string, challengeId: string): Promise<void> {
  const { challenge, isParticipant } = await requireChallengeAccess(challengeId, userId);
  if (isParticipant) return;
  if (challenge.status === "archived") throw new AppError("Arşivlenmiş bir listeye katılamazsın.");

  await db.transaction(async (tx) => {
    // New (or returning) participants join at the end of the rotation; current rounds keep
    // their stored assignments and the next round includes them.
    const [{ last }] = await tx
      .select({ last: max(challengeParticipants.position) })
      .from(challengeParticipants)
      .where(eq(challengeParticipants.challengeId, challengeId));
    const position = (last ?? -1) + 1;
    await tx
      .insert(challengeParticipants)
      .values({ challengeId, userId, position })
      .onConflictDoUpdate({
        target: [challengeParticipants.challengeId, challengeParticipants.userId],
        set: { isActive: true, position },
      });
    await logActivity(tx, { groupId: challenge.groupId, challengeId, actorId: userId, type: "challenge.joined" });
  });
}

export async function leaveChallenge(userId: string, challengeId: string): Promise<void> {
  const { challenge, isParticipant } = await requireChallengeAccess(challengeId, userId);
  if (!isParticipant) return;
  await db
    .update(challengeParticipants)
    .set({ isActive: false })
    .where(and(eq(challengeParticipants.challengeId, challengeId), eq(challengeParticipants.userId, userId)));
  await logActivity(db, { groupId: challenge.groupId, challengeId, actorId: userId, type: "challenge.left" });
  // Items everyone still taking part has finished are done now.
  await settleEntries(challengeId);
}

export async function setChallengeStatus(
  userId: string,
  challengeId: string,
  status: "active" | "paused" | "archived",
): Promise<void> {
  const { challenge, canManage } = await requireChallengeAccess(challengeId, userId);
  if (!canManage) throw new AppError("Bu listeyi yalnızca oluşturan kişi ya da grup yöneticileri yönetebilir.");
  if (challenge.status === status) return;
  await db.update(challenges).set({ status }).where(eq(challenges.id, challengeId));
  await logActivity(db, {
    groupId: challenge.groupId,
    challengeId,
    actorId: userId,
    type: "challenge.status_changed",
    data: { status },
  });
}

export async function advanceTurn(userId: string, challengeId: string): Promise<void> {
  const { challenge, isParticipant, canManage } = await requireChallengeAccess(challengeId, userId);
  if (!isParticipant && !canManage) throw new AppError("Turu yalnızca katılımcılar ilerletebilir.");
  if (challenge.cadenceUnit !== "none") throw new AppError("Bu listede turlar takvime göre kendiliğinden ilerler.");
  if (challenge.status !== "active") throw new AppError("Liste aktif değil.");
  await startNextTurn(challenge, userId);
}

async function requirePoolRound(userId: string, challengeId: string) {
  const access = await requireChallengeAccess(challengeId, userId);
  if (!access.isParticipant) throw new AppError("Havuzdan seçim yapmak için listeye katılmalısın.");
  const { challenge } = access;
  const strategy = getStrategy(challenge.strategy);
  const rules = strategy.poolRules?.(parseStoredConfig(strategy, challenge.strategyConfig));
  if (!rules) throw new AppError("Bu liste ortak havuz kullanmıyor.");
  const round = await getCurrentRound(challenge);
  if (!round) throw new AppError("Şu an aktif bir tur yok.");
  return { challenge, rules, round };
}

export async function drawFromPool(userId: string, challengeId: string): Promise<number> {
  const { challenge, rules, round } = await requirePoolRound(userId, challengeId);
  const selection = rules.selection === "manual" ? "random" : rules.selection; // explicit request = draw
  const picked = await drawForRound(
    { challengeId, groupId: challenge.groupId, roundId: round.id },
    { ...rules, selection },
    userId,
  );
  if (picked === 0) throw new AppError("Seçilecek aday yok ya da bu turun seçimi zaten tamamlandı.");
  return picked;
}

export async function selectPoolEntry(userId: string, entryId: string): Promise<string> {
  const [entry] = await db
    .select({ challengeId: entries.challengeId })
    .from(entries)
    .where(eq(entries.id, entryId))
    .limit(1);
  if (!entry) throw new AppError("Öge bulunamadı.");
  const { challenge, rules, round } = await requirePoolRound(userId, entry.challengeId);
  const result = await selectIntoRound(
    { challengeId: challenge.id, groupId: challenge.groupId, roundId: round.id },
    entryId,
    rules,
    userId,
  );
  if (result === "full") throw new AppError("Bu turun seçimi zaten tamamlandı.");
  if (result === "unavailable") throw new AppError("Bu öge artık havuzda değil.");
  return challenge.id;
}
