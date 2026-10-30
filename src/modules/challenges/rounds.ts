import "server-only";
import { and, asc, desc, eq, gt, inArray, max } from "drizzle-orm";
import { db, type Executor, type Transaction } from "@/db";
import { challengeParticipants, challenges, groups, roundAssignments, rounds } from "@/db/schema";
import { logActivity } from "@/modules/activity/service";
import { isTimeBased, periodAt, periodIndexAt, todayIn, type Cadence, type Period } from "./domain/cadence";
import { getStrategy, parseStoredConfig, type Participant } from "./domain/strategies";
import { drawForRound } from "./pool";

// Rounds are materialized lazily: whenever a page needs a challenge, missing periods up to
// "today" (in the group's time zone) are inserted together with the strategy's assignments.
// Idempotent and race-safe thanks to the (challenge_id, index) unique index — no cron needed.
// Planning (domain/plan.ts) may create future rounds early; rounds always stay contiguous from
// index 0, so "highest index" is enough to know what is missing.

export type RoundsChallenge = {
  id: string;
  groupId: string;
  strategy: string;
  strategyConfig: Record<string, unknown>;
  cadenceUnit: Cadence["unit"];
  cadenceInterval: number;
  startsOn: string;
  endsOn: string | null;
  status: "active" | "paused" | "archived";
  timezone: string;
};

export type RoundRow = typeof rounds.$inferSelect;

export const cadenceOf = (challenge: Pick<RoundsChallenge, "cadenceUnit" | "cadenceInterval">): Cadence => ({
  unit: challenge.cadenceUnit,
  interval: challenge.cadenceInterval,
});

export async function activeParticipants(challengeId: string, executor: Executor = db): Promise<Participant[]> {
  return executor
    .select({ userId: challengeParticipants.userId, position: challengeParticipants.position })
    .from(challengeParticipants)
    .where(and(eq(challengeParticipants.challengeId, challengeId), eq(challengeParticipants.isActive, true)))
    .orderBy(asc(challengeParticipants.position));
}

function missingPeriods(challenge: RoundsChallenge, maxIndex: number, now: Date): Period[] {
  const today = todayIn(challenge.timezone, now);
  if (today < challenge.startsOn) return [];

  const cadence = cadenceOf(challenge);
  if (!isTimeBased(cadence)) {
    return maxIndex < 0 ? [{ index: 0, startsOn: challenge.startsOn, endsOn: null }] : [];
  }

  const lastDay = challenge.endsOn && challenge.endsOn < today ? challenge.endsOn : today;
  return periodsBetween(challenge, maxIndex + 1, periodIndexAt(challenge.startsOn, cadence, lastDay));
}

function periodsBetween(challenge: RoundsChallenge, from: number, to: number): Period[] {
  const periods: Period[] = [];
  for (let index = from; index <= to; index++) {
    periods.push(periodAt(challenge.startsOn, cadenceOf(challenge), index, challenge.endsOn));
  }
  return periods;
}

/** Inserts rounds (skipping existing ones) and stores the strategy's assignments for the new ones. */
async function insertRoundsTx(tx: Transaction, challenge: RoundsChallenge, periods: Period[]) {
  if (periods.length === 0) return [];
  const strategy = getStrategy(challenge.strategy);
  const config = parseStoredConfig(strategy, challenge.strategyConfig);
  const participants = await activeParticipants(challenge.id, tx);
  const inserted = await tx
    .insert(rounds)
    .values(periods.map((p) => ({ challengeId: challenge.id, index: p.index, startsOn: p.startsOn, endsOn: p.endsOn })))
    .onConflictDoNothing({ target: [rounds.challengeId, rounds.index] })
    .returning({ id: rounds.id, index: rounds.index });

  const assignments = inserted.flatMap((round) =>
    strategy
      .planRound({ config, roundIndex: round.index, participants })
      .map((plan) => ({ roundId: round.id, pickerId: plan.pickerId, recipientId: plan.recipientId })),
  );
  if (assignments.length > 0) await tx.insert(roundAssignments).values(assignments);
  return inserted;
}

async function insertRounds(challenge: RoundsChallenge, periods: Period[]) {
  const created = await db.transaction((tx) => insertRoundsTx(tx, challenge, periods));

  // Pool strategies can fill the round that just started.
  const strategy = getStrategy(challenge.strategy);
  const rules = strategy.poolRules?.(parseStoredConfig(strategy, challenge.strategyConfig));
  const newest = created.find((round) => round.index === periods[periods.length - 1].index);
  if (rules?.autoDraw && newest) {
    await drawForRound({ challengeId: challenge.id, groupId: challenge.groupId, roundId: newest.id }, rules, null);
  }
}

/** Planning: makes sure rounds 0…index of a time-based challenge exist (future ones included). */
export async function createRoundsThrough(tx: Transaction, challenge: RoundsChallenge, index: number): Promise<void> {
  const [{ maxIndex }] = await tx
    .select({ maxIndex: max(rounds.index) })
    .from(rounds)
    .where(eq(rounds.challengeId, challenge.id));
  await insertRoundsTx(tx, challenge, periodsBetween(challenge, (maxIndex ?? -1) + 1, index));
}

/**
 * Rounds that haven't started yet (created early when something was added ahead) follow the
 * participants and options as they are now: their assignments are drawn again after a change.
 */
export async function replanUpcomingRounds(challengeId: string): Promise<void> {
  const [challenge] = await db
    .select({ strategy: challenges.strategy, strategyConfig: challenges.strategyConfig, timezone: groups.timezone })
    .from(challenges)
    .innerJoin(groups, eq(groups.id, challenges.groupId))
    .where(eq(challenges.id, challengeId))
    .limit(1);
  if (!challenge) return;
  const strategy = getStrategy(challenge.strategy);
  const config = parseStoredConfig(strategy, challenge.strategyConfig);
  await db.transaction(async (tx) => {
    const upcoming = await tx
      .select({ id: rounds.id, index: rounds.index })
      .from(rounds)
      .where(and(eq(rounds.challengeId, challengeId), gt(rounds.startsOn, todayIn(challenge.timezone))));
    if (upcoming.length === 0) return;
    const participants = await activeParticipants(challengeId, tx);
    await tx.delete(roundAssignments).where(inArray(roundAssignments.roundId, upcoming.map((round) => round.id)));
    const assignments = upcoming.flatMap((round) =>
      strategy
        .planRound({ config, roundIndex: round.index, participants })
        .map((plan) => ({ roundId: round.id, pickerId: plan.pickerId, recipientId: plan.recipientId })),
    );
    if (assignments.length > 0) await tx.insert(roundAssignments).values(assignments);
  });
}

/** Brings the rounds of the given challenges up to date (one query when nothing is missing). */
export async function syncRounds(list: readonly RoundsChallenge[], now: Date = new Date()): Promise<void> {
  const active = list.filter((challenge) => challenge.status === "active");
  if (active.length === 0) return;

  const maxRows = await db
    .select({ challengeId: rounds.challengeId, maxIndex: max(rounds.index) })
    .from(rounds)
    .where(inArray(rounds.challengeId, active.map((challenge) => challenge.id)))
    .groupBy(rounds.challengeId);
  const maxById = new Map(maxRows.map((row) => [row.challengeId, row.maxIndex ?? -1]));

  for (const challenge of active) {
    const periods = missingPeriods(challenge, maxById.get(challenge.id) ?? -1, now);
    if (periods.length > 0) await insertRounds(challenge, periods);
  }
}

/** The round suggestions currently go into, or null (not started, ended, or between turns). */
export async function getCurrentRound(challenge: RoundsChallenge, now: Date = new Date()): Promise<RoundRow | null> {
  const today = todayIn(challenge.timezone, now);
  const cadence = cadenceOf(challenge);

  if (isTimeBased(cadence)) {
    // Planned rounds may already exist further ahead, so look the period up by date.
    if (today < challenge.startsOn || (challenge.endsOn && today > challenge.endsOn)) return null;
    const index = periodIndexAt(challenge.startsOn, cadence, today);
    const [round] = await db
      .select()
      .from(rounds)
      .where(and(eq(rounds.challengeId, challenge.id), eq(rounds.index, index)))
      .limit(1);
    return round ?? null;
  }

  const [latest] = await db
    .select()
    .from(rounds)
    .where(eq(rounds.challengeId, challenge.id))
    .orderBy(desc(rounds.index))
    .limit(1);
  if (!latest || latest.closedAt) return null;
  if (today < latest.startsOn || (latest.endsOn && today > latest.endsOn)) return null;
  return latest;
}

/** Indefinite challenges move on manually: close the current turn and open the next one. */
export async function startNextTurn(challenge: RoundsChallenge, actorId: string, now: Date = new Date()): Promise<void> {
  const strategy = getStrategy(challenge.strategy);
  const config = parseStoredConfig(strategy, challenge.strategyConfig);
  const today = todayIn(challenge.timezone, now);

  const next = await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(rounds)
      .where(eq(rounds.challengeId, challenge.id))
      .orderBy(desc(rounds.index))
      .limit(1)
      .for("update");
    if (current && !current.closedAt) {
      await tx.update(rounds).set({ closedAt: now, endsOn: today }).where(eq(rounds.id, current.id));
    }

    const index = current ? current.index + 1 : 0;
    const [created] = await tx
      .insert(rounds)
      .values({ challengeId: challenge.id, index, startsOn: today, endsOn: null })
      .onConflictDoNothing({ target: [rounds.challengeId, rounds.index] })
      .returning({ id: rounds.id, index: rounds.index });
    if (!created) return null; // a concurrent click already advanced it

    const participants = await activeParticipants(challenge.id, tx);
    const assignments = strategy
      .planRound({ config, roundIndex: index, participants })
      .map((plan) => ({ roundId: created.id, pickerId: plan.pickerId, recipientId: plan.recipientId }));
    if (assignments.length > 0) await tx.insert(roundAssignments).values(assignments);

    await logActivity(tx, {
      groupId: challenge.groupId,
      challengeId: challenge.id,
      actorId,
      type: "round.started",
      data: { index },
    });
    return created;
  });

  const rules = strategy.poolRules?.(config);
  if (next && rules?.autoDraw) {
    await drawForRound({ challengeId: challenge.id, groupId: challenge.groupId, roundId: next.id }, rules, null);
  }
}
