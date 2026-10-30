import "server-only";
import { and, count, eq, inArray, isNull, ne } from "drizzle-orm";
import { db, type Executor } from "@/db";
import { entries, roundAssignments, rounds, workflowStates } from "@/db/schema";
import type { EntryCard } from "@/modules/entries/queries";
import { roundTiming, summarizeRound, type RoundTiming } from "@/modules/entries/tracking";
import { isTimeBased, periodAt, todayIn } from "./domain/cadence";
import { fillSlots, poolRoundOptions, roundOptions, slotKey, type RoundItem } from "./domain/additions";
import { formatPeriodLabel, lastRoundIndex, listSlots, type PlanRound } from "./domain/plan";
import { getStrategy, parseStoredConfig, type AssignmentPlan, type SuggestionOptions } from "./domain/strategies";
import { roundLabel } from "./planning";
import { activeParticipants, cadenceOf, getCurrentRound, type RoundsChallenge } from "./rounds";

// Where an addition goes on a list without planning (see domain/additions.ts): the current round by
// default, the pool on a pool list, or any other round: one that is over, or on a calendar one that
// hasn't started yet (created when something goes into it, so rounds stay contiguous). The list's own
// rule decides, asked about that round as it would be about the current one.

/** A round of a list: an existing one, or on a calendar one ahead that has no row yet (`id` null). */
export type RoundRef = { index: number; id: string | null; timing: RoundTiming; label: string; endsOn: string | null };

type RoundLike = { id: string; index: number; startsOn: string; endsOn: string | null; closedAt: Date | null };

function toRef(challenge: RoundsChallenge, row: RoundLike, today: string): RoundRef {
  return { index: row.index, id: row.id, timing: roundTiming(row, today), label: roundLabel(challenge, row), endsOn: row.endsOn };
}

/** Round `index`: an existing one, or a calendar round that hasn't started (up to the list's end); null when there is none. */
export async function findRound(executor: Executor, challenge: RoundsChallenge, index: number): Promise<RoundRef | null> {
  if (!Number.isInteger(index) || index < 0) return null;
  const today = todayIn(challenge.timezone);
  const [row] = await executor
    .select()
    .from(rounds)
    .where(and(eq(rounds.challengeId, challenge.id), eq(rounds.index, index)))
    .limit(1);
  if (row) return toRef(challenge, row, today);

  const cadence = cadenceOf(challenge);
  if (!isTimeBased(cadence)) return null;
  const last = lastRoundIndex({ startsOn: challenge.startsOn, endsOn: challenge.endsOn, cadence });
  if (last !== null && index > last) return null;
  const period = periodAt(challenge.startsOn, cadence, index, challenge.endsOn);
  // Rounds up to today always exist (see syncRounds), so a missing one is still ahead.
  if (period.startsOn <= today) return null;
  return { index, id: null, timing: "future", label: formatPeriodLabel(period.startsOn, period.endsOn), endsOn: period.endsOn };
}

export async function findCurrentRound(challenge: RoundsChallenge): Promise<RoundRef | null> {
  const row = await getCurrentRound(challenge);
  return row ? toRef(challenge, row, todayIn(challenge.timezone)) : null;
}

async function storedAssignments(executor: Executor, roundIds: readonly string[]) {
  if (roundIds.length === 0) return [];
  return executor
    .select({ roundId: roundAssignments.roundId, pickerId: roundAssignments.pickerId, recipientId: roundAssignments.recipientId })
    .from(roundAssignments)
    .where(inArray(roundAssignments.roundId, [...roundIds]));
}

/**
 * What `userId` may add into `round` by the list's rule: the free places of a pool list's round, or
 * the strategy's suggestion rule asked about that round. Without a round it is a pool list's pool
 * (elsewhere the rule says there is no round running).
 */
export async function checkTarget(
  executor: Executor,
  challenge: RoundsChallenge,
  userId: string,
  round: RoundRef | null,
): Promise<SuggestionOptions> {
  const strategy = getStrategy(challenge.strategy);
  const config = parseStoredConfig(strategy, challenge.strategyConfig);
  const items: RoundItem[] = round?.id
    ? await executor
        .select({ suggestedBy: entries.suggestedBy, recipientId: entries.suggestedFor })
        .from(entries)
        .innerJoin(workflowStates, eq(workflowStates.id, entries.stateId))
        .where(and(eq(entries.roundId, round.id), ne(workflowStates.category, "dropped")))
    : [];
  const pool = strategy.poolRules?.(config) ?? null;
  if (pool && round) return poolRoundOptions(pool, items.length);

  const participants = await activeParticipants(challenge.id, executor);
  if (!round) {
    const [{ waiting }] = await executor
      .select({ waiting: count() })
      .from(entries)
      .innerJoin(workflowStates, eq(workflowStates.id, entries.stateId))
      .where(
        and(
          eq(entries.challengeId, challenge.id),
          eq(entries.suggestedBy, userId),
          isNull(entries.roundId),
          eq(workflowStates.category, "pending"),
        ),
      );
    return strategy.suggestionOptions({ config, userId, participants, round: null, assignments: [], roundSuggestions: [], poolCandidates: waiting });
  }
  const assignments: AssignmentPlan[] = round.id
    ? await storedAssignments(executor, [round.id])
    : strategy.planRound({ config, roundIndex: round.index, participants });
  return roundOptions(strategy, config, { index: round.index, assignments, items }, participants, userId);
}

/** Rounds an addition can go into, oldest first: those that are over, the current one and, on a calendar, those ahead. */
export function selectableRounds(
  challenge: RoundsChallenge,
  roundRows: readonly PlanRound[],
  filledByRound: ReadonlyMap<string, number>,
): RoundRef[] {
  const today = todayIn(challenge.timezone);
  const cadence = cadenceOf(challenge);
  if (!isTimeBased(cadence)) return roundRows.map((row) => toRef(challenge, row, today));
  return listSlots({
    calendar: { startsOn: challenge.startsOn, endsOn: challenge.endsOn, cadence },
    today,
    rounds: roundRows,
    filledByRound,
    mode: "select",
  }).map((slot) => ({ index: slot.index, id: slot.roundId, timing: slot.timing, label: slot.label, endsOn: slot.endsOn }));
}

type Viewer = { id: string; isParticipant: boolean; isAdmin: boolean };
type ParticipantRow = { userId: string; name: string; position: number; isActive: boolean };

/**
 * The rounds of a list without planning, as the page shows them: the current one, those ahead (on a
 * calendar) and those that are over (newest first). Each has its items, a rotation's assignments with
 * their picks, and what the viewer may add there: their own pick, or as a group admin anyone's.
 */
export async function loadTimeline(
  challenge: RoundsChallenge,
  input: { roundRows: readonly PlanRound[]; cards: readonly EntryCard[]; participants: readonly ParticipantRow[]; viewer: Viewer },
) {
  const { roundRows, cards, participants, viewer } = input;
  const strategy = getStrategy(challenge.strategy);
  const config = parseStoredConfig(strategy, challenge.strategyConfig);
  const pool = strategy.poolRules?.(config) ?? null;
  const today = todayIn(challenge.timezone);
  const cadence = cadenceOf(challenge);
  const active = participants.filter((participant) => participant.isActive).map(({ userId, position }) => ({ userId, position }));
  const names = new Map(participants.map((participant) => [participant.userId, participant.name]));
  const position = (userId: string) => participants.find((participant) => participant.userId === userId)?.position ?? Infinity;
  const inPlay = cards.filter((card) => card.state.category !== "dropped");
  const filledByRound = new Map<string, number>();
  for (const card of inPlay) if (card.roundId) filledByRound.set(card.roundId, (filledByRound.get(card.roundId) ?? 0) + 1);

  const refs = roundRows.map((row) => toRef(challenge, row, today));
  const current = refs.find((ref) => ref.timing === "current") ?? null;
  const past = refs.filter((ref) => ref.timing === "past").sort((a, b) => b.index - a.index);
  const upcoming = isTimeBased(cadence)
    ? listSlots({ calendar: { startsOn: challenge.startsOn, endsOn: challenge.endsOn, cadence }, today, rounds: roundRows, filledByRound, mode: "show" })
        .filter((slot) => slot.timing === "future")
        .map((slot): RoundRef => ({ index: slot.index, id: slot.roundId, timing: "future", label: slot.label, endsOn: slot.endsOn }))
    : [];
  const stored = await storedAssignments(
    db,
    [current, ...past, ...upcoming].flatMap((ref) => (ref?.id ? [ref.id] : [])),
  );
  const open = challenge.status === "active";

  const view = (round: RoundRef) => {
    const assignments = (round.id ? stored.filter((row) => row.roundId === round.id) : strategy.planRound({ config, roundIndex: round.index, participants: active }))
      .map(({ pickerId, recipientId }) => ({ pickerId, recipientId }))
      .sort((a, b) => position(a.pickerId) - position(b.pickerId));
    const items = round.id ? inPlay.filter((card) => card.roundId === round.id) : [];
    const roundItems = items.map((card) => ({ suggestedBy: card.suggestedBy?.id ?? null, recipientId: card.suggestedFor?.id ?? null }));
    const optionsFor = (userId: string) =>
      pool ? poolRoundOptions(pool, items.length) : roundOptions(strategy, config, { index: round.index, assignments, items: roundItems }, active, userId);
    const mine = open && viewer.isParticipant ? optionsFor(viewer.id) : null;
    const { slots, extras } = fillSlots(assignments, items, (card) => ({
      pickerId: card.suggestedBy?.id ?? null,
      recipientId: card.suggestedFor?.id ?? null,
    }));
    return {
      index: round.index,
      label: round.label,
      timing: round.timing,
      summary: summarizeRound(items.map((card) => ({ category: card.state.category, tracking: card.tracking }))),
      items,
      slots: slots.map((slot) => {
        const own = slot.pickerId === viewer.id;
        const options = own ? mine : open && viewer.isAdmin ? optionsFor(slot.pickerId) : null;
        const fits = Boolean(options?.allowed && options.targets.includes(slot.recipientId));
        return {
          key: slotKey(slot),
          pickerId: slot.pickerId,
          pickerName: names.get(slot.pickerId) ?? "?",
          recipientId: slot.recipientId,
          recipientName: slot.recipientId ? (names.get(slot.recipientId) ?? "?") : null,
          entries: slot.entries,
          add: fits ? (own ? ("own" as const) : ("behalf" as const)) : null,
        };
      }),
      extras,
      // Lists without assignments: the viewer's own item fits, or an admin adds for whoever still can.
      canAdd: open && (Boolean(mine?.allowed) || (viewer.isAdmin && (pool ? optionsFor(viewer.id).allowed : true))),
    };
  };

  return { current: current ? view(current) : null, upcoming: upcoming.map(view), past: past.map(view) };
}

export type Timeline = Awaited<ReturnType<typeof loadTimeline>>;
export type RoundView = Timeline["past"][number];
