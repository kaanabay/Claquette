import "server-only";
import { and, eq, inArray, max } from "drizzle-orm";
import { db, type Executor, type Transaction } from "@/db";
import {
  challengeParticipants,
  challenges,
  entries,
  groupMembers,
  mediaItems,
  mediaTypes,
  rounds,
  users,
  workflows,
  workflowStates,
} from "@/db/schema";
import { AppError } from "@/lib/action-state";
import { logActivity } from "@/modules/activity/service";
import { settleEntries } from "@/modules/entries/settle";
import { loadChallenge, requireChallengeAccess, type ChallengeRecord } from "./context";
import { isTimeBased, periodAt, type CadenceUnit } from "./domain/cadence";
import { lastRoundIndex } from "./domain/plan";
import { confirmationKey, planSettingsChange, type ChallengeSettings, type SettingsChange, type SettingsFacts } from "./domain/settings";
import { getStrategy, parseStoredConfig, STRATEGIES } from "./domain/strategies";
import { roundLabel } from "./planning";

// Editing a list in use. Planning happens inside the transaction, with the list locked like an
// addition locks it, so the consequences shown are the ones applied (see domain/settings.ts).

export async function activeParticipantIds(challengeId: string, executor: Executor = db): Promise<string[]> {
  const rows = await executor
    .select({ userId: challengeParticipants.userId })
    .from(challengeParticipants)
    .where(and(eq(challengeParticipants.challengeId, challengeId), eq(challengeParticipants.isActive, true)));
  return rows.map((row) => row.userId);
}

export function currentSettings(challenge: ChallengeRecord, participants: string[]): ChallengeSettings {
  return {
    title: challenge.title,
    description: challenge.description,
    mediaTypes: challenge.mediaTypes,
    cadenceUnit: challenge.cadenceUnit,
    cadenceInterval: challenge.cadenceInterval,
    startsOn: challenge.startsOn,
    endsOn: challenge.endsOn,
    strategy: challenge.strategy,
    strategyConfig: parseStoredConfig(getStrategy(challenge.strategy), challenge.strategyConfig),
    workflowId: challenge.workflowId,
    participants,
  };
}

async function loadFacts(tx: Transaction, challenge: ChallengeRecord, people: string[]): Promise<SettingsFacts> {
  const [entryRows, typeRows, workflowRows, userRows] = await Promise.all([
    tx
      .select({
        roundIndex: rounds.index,
        roundStartsOn: rounds.startsOn,
        roundEndsOn: rounds.endsOn,
        category: workflowStates.category,
        mediaType: mediaItems.mediaType,
      })
      .from(entries)
      .innerJoin(workflowStates, eq(workflowStates.id, entries.stateId))
      .innerJoin(mediaItems, eq(mediaItems.id, entries.mediaItemId))
      .leftJoin(rounds, eq(rounds.id, entries.roundId))
      .where(eq(entries.challengeId, challenge.id)),
    tx.select({ slug: mediaTypes.slug, label: mediaTypes.label }).from(mediaTypes),
    tx.select({ id: workflows.id, name: workflows.name }).from(workflows),
    people.length ? tx.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, people)) : Promise.resolve([]),
  ]);

  const fills = new Map<number, { index: number; label: string; count: number }>();
  const typeCounts: Record<string, number> = {};
  let lastFilledRound: SettingsFacts["lastFilledRound"] = null;
  for (const row of entryRows) {
    if (row.roundIndex === null || row.roundStartsOn === null) {
      if (row.category !== "dropped") typeCounts[row.mediaType] = (typeCounts[row.mediaType] ?? 0) + 1;
      continue;
    }
    const label = roundLabel(challenge, { index: row.roundIndex, startsOn: row.roundStartsOn, endsOn: row.roundEndsOn });
    if (!lastFilledRound || row.roundIndex > lastFilledRound.index) lastFilledRound = { index: row.roundIndex, label };
    if (row.category === "dropped") continue;
    typeCounts[row.mediaType] = (typeCounts[row.mediaType] ?? 0) + 1;
    const fill = fills.get(row.roundIndex) ?? { index: row.roundIndex, label, count: 0 };
    fills.set(row.roundIndex, { ...fill, count: fill.count + 1 });
  }

  return {
    entryCount: entryRows.length,
    rounds: [...fills.values()].sort((a, b) => a.index - b.index),
    lastFilledRound,
    typeCounts,
    typeLabels: Object.fromEntries(typeRows.map((type) => [type.slug, type.label])),
    names: Object.fromEntries(userRows.map((user) => [user.id, user.name])),
    strategyLabels: Object.fromEntries(STRATEGIES.map((strategy) => [strategy.key, strategy.label])),
    workflowNames: Object.fromEntries(workflowRows.map((workflow) => [workflow.id, workflow.name])),
  };
}

/** A new end date: rounds after it go (they're empty, see the plan), the last one ends on it. */
async function refitRounds(tx: Transaction, challenge: ChallengeRecord, endsOn: string | null): Promise<void> {
  const cadence = { unit: challenge.cadenceUnit, interval: challenge.cadenceInterval };
  const last = lastRoundIndex({ startsOn: challenge.startsOn, endsOn, cadence });
  const rows = await tx
    .select({ id: rounds.id, index: rounds.index, endsOn: rounds.endsOn })
    .from(rounds)
    .where(eq(rounds.challengeId, challenge.id));
  for (const row of rows) {
    if (last !== null && row.index > last) {
      await tx.delete(rounds).where(eq(rounds.id, row.id));
      continue;
    }
    const period = periodAt(challenge.startsOn, cadence, row.index, endsOn);
    if (period.endsOn !== row.endsOn) await tx.update(rounds).set({ endsOn: period.endsOn }).where(eq(rounds.id, row.id));
  }
}

/** What the settings form sends. Timing, rule and workflow are left out once they can't change. */
export type SettingsPatch = {
  title: string;
  description: string | null;
  mediaTypes: string[];
  endsOn: string | null;
  participants: string[];
  cadence?: { unit: CadenceUnit; interval: number };
  startsOn?: string;
  strategy: string;
  /** Already parsed by the strategy's schema. */
  strategyConfig: Record<string, unknown>;
  workflowId?: string | null;
};

export type SettingsOutcome =
  | { status: "saved" | "unchanged" }
  | { status: "confirm"; token: string; changes: SettingsChange[] };

export async function updateChallengeSettings(
  userId: string,
  challengeId: string,
  patch: SettingsPatch,
  confirmToken: string | null,
): Promise<SettingsOutcome> {
  const { challenge: loaded, canManage } = await requireChallengeAccess(challengeId, userId);
  if (!canManage) throw new AppError("Bu listenin ayarlarını yalnızca kuran kişi ya da grup yöneticileri değiştirebilir.");

  const [members, knownTypes, workflow] = await Promise.all([
    db.select({ userId: groupMembers.userId }).from(groupMembers).where(eq(groupMembers.groupId, loaded.groupId)),
    patch.mediaTypes.length
      ? db.select({ slug: mediaTypes.slug }).from(mediaTypes).where(inArray(mediaTypes.slug, patch.mediaTypes))
      : Promise.resolve([]),
    patch.workflowId
      ? db.select({ id: workflows.id, groupId: workflows.groupId }).from(workflows).where(eq(workflows.id, patch.workflowId)).limit(1)
      : Promise.resolve([]),
  ]);
  if (patch.workflowId && (!workflow[0] || (workflow[0].groupId !== null && workflow[0].groupId !== loaded.groupId))) {
    throw new AppError("Seçilen durum akışı bu grupta kullanılamaz.");
  }
  const memberIds = new Set(members.map((member) => member.userId));

  let left: string[] = [];
  const outcome = await db.transaction(async (tx): Promise<SettingsOutcome> => {
    // The same lock an addition takes: nothing lands in a round while the plan is checked and applied.
    await tx.select({ id: challenges.id }).from(challenges).where(eq(challenges.id, challengeId)).for("update");
    const challenge = (await loadChallenge(challengeId, tx))!;
    const before = currentSettings(challenge, await activeParticipantIds(challengeId, tx));
    const after: ChallengeSettings = {
      title: patch.title,
      description: patch.description,
      mediaTypes: knownTypes.map((type) => type.slug),
      cadenceUnit: patch.cadence?.unit ?? before.cadenceUnit,
      cadenceInterval: patch.cadence ? (patch.cadence.unit === "none" ? 1 : patch.cadence.interval) : before.cadenceInterval,
      startsOn: patch.startsOn ?? before.startsOn,
      endsOn: patch.endsOn,
      strategy: patch.strategy,
      strategyConfig: patch.strategyConfig,
      workflowId: patch.workflowId ?? before.workflowId,
      // People who left the group meanwhile can't be kept or added.
      participants: [...new Set(patch.participants)].filter((id) => memberIds.has(id)),
    };
    if (after.endsOn && after.endsOn < after.startsOn) throw new AppError("Bitiş tarihi başlangıçtan önce olamaz.");

    const facts = await loadFacts(tx, challenge, [...new Set([...before.participants, ...after.participants, ...memberIds])]);
    const changes = planSettingsChange(before, after, facts, getStrategy(after.strategy));
    if (changes.length === 0) return { status: "unchanged" };
    const blocked = changes.filter((change) => change.level === "blocked");
    if (blocked.length > 0) throw new AppError(blocked.map((change) => change.message).join(" "));
    const token = confirmationKey(changes);
    if (changes.some((change) => change.level === "confirm") && confirmToken !== token) return { status: "confirm", token, changes };

    // Fields that may not change are blocked above, so writing them all is safe.
    await tx
      .update(challenges)
      .set({
        title: after.title,
        description: after.description,
        mediaTypes: after.mediaTypes,
        cadenceUnit: after.cadenceUnit,
        cadenceInterval: after.cadenceInterval,
        startsOn: after.startsOn,
        endsOn: after.endsOn,
        strategy: after.strategy,
        strategyConfig: after.strategyConfig,
        workflowId: after.workflowId,
      })
      .where(eq(challenges.id, challengeId));

    const timingChanged =
      after.cadenceUnit !== before.cadenceUnit || after.cadenceInterval !== before.cadenceInterval || after.startsOn !== before.startsOn;
    if (timingChanged || after.strategy !== before.strategy) {
      // Only possible while the list is empty: its rounds are rebuilt with the new settings.
      await tx.delete(rounds).where(eq(rounds.challengeId, challengeId));
    } else if (after.endsOn !== before.endsOn && isTimeBased({ unit: after.cadenceUnit, interval: after.cadenceInterval })) {
      await refitRounds(tx, challenge, after.endsOn);
    }

    const joined = after.participants.filter((id) => !before.participants.includes(id));
    left = before.participants.filter((id) => !after.participants.includes(id));
    if (left.length > 0) {
      await tx
        .update(challengeParticipants)
        .set({ isActive: false })
        .where(and(eq(challengeParticipants.challengeId, challengeId), inArray(challengeParticipants.userId, left)));
    }
    if (joined.length > 0) {
      const [{ last }] = await tx
        .select({ last: max(challengeParticipants.position) })
        .from(challengeParticipants)
        .where(eq(challengeParticipants.challengeId, challengeId));
      let position = last ?? -1;
      for (const id of joined) {
        position += 1;
        await tx
          .insert(challengeParticipants)
          .values({ challengeId, userId: id, position })
          .onConflictDoUpdate({
            target: [challengeParticipants.challengeId, challengeParticipants.userId],
            set: { isActive: true, position },
          });
      }
    }

    await logActivity(tx, {
      groupId: challenge.groupId,
      challengeId,
      actorId: userId,
      type: "challenge.updated",
      data: { title: after.title, fields: [...new Set(changes.map((change) => change.field))] },
    });
    return { status: "saved" };
  });

  // Items everyone still taking part has finished are done now.
  if (outcome.status === "saved" && left.length > 0) await settleEntries(challengeId);
  return outcome;
}
