import "server-only";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db, type Executor, type Transaction } from "@/db";
import { challenges, entries, entryProgress, entryVotes, mediaItems, notes, rounds, users, workflowStates } from "@/db/schema";
import { qualified } from "@/db/sql";
import { AppError, type BatchResult } from "@/lib/action-state";
import { fromDayValue } from "@/lib/short-date";
import { isUuid } from "@/lib/utils";
import { logActivity } from "@/modules/activity/service";
import { requireChallengeAccess } from "@/modules/challenges/context";
import { canAddAs, startingCategory } from "@/modules/challenges/domain/additions";
import { canAcceptSuggestion, isPlanStateChangeAllowed } from "@/modules/challenges/domain/plan";
import { getStrategy, parseStoredConfig } from "@/modules/challenges/domain/strategies";
import {
  assertRoomInRound,
  lockSlot,
  PastLastRoundError,
  planningRules,
  poolRulesOf,
  roundLabel,
  RoundFullError,
} from "@/modules/challenges/planning";
import { roomInPoolRound } from "@/modules/challenges/pool";
import { activeParticipants, createRoundsThrough, syncRounds } from "@/modules/challenges/rounds";
import { getSuggestionState } from "@/modules/challenges/suggestions";
import { checkTarget, findCurrentRound, findRound, type RoundRef } from "@/modules/challenges/targets";
import { resolveMediaItem, type MediaInput, type ResolvedMedia } from "@/modules/media/service";
import { titleColumns } from "@/modules/media/columns";
import { formatTitle } from "@/modules/media/titles";
import { canChangeState, firstStateIn, initialState, type StateCategory } from "@/modules/workflows/domain";
import { getChallengeStates } from "@/modules/workflows/queries";
import { canDeleteEntry, finishOnDay } from "./domain";
import type { ProgressStatus } from "./labels";
import { canTakeOffRound, placeOf, waitingPlaceOf } from "./placement";
import {
  assigneesOf,
  everyoneGaveUp,
  finishedBy,
  isSettled,
  progressOutcome,
  stateAfterProgress,
  type FinishedChoice,
  type RoundTiming,
} from "./tracking";

async function loadEntryContext(entryId: string, userId: string) {
  if (!isUuid(entryId)) throw new AppError("Öge bulunamadı.");
  const [entry] = await db
    .select({
      id: entries.id,
      challengeId: entries.challengeId,
      roundId: entries.roundId,
      stateId: entries.stateId,
      suggestedBy: entries.suggestedBy,
      suggestedFor: entries.suggestedFor,
      media: titleColumns,
      category: workflowStates.category,
      stateLabel: workflowStates.label,
    })
    .from(entries)
    .innerJoin(mediaItems, eq(mediaItems.id, entries.mediaItemId))
    .innerJoin(workflowStates, eq(workflowStates.id, entries.stateId))
    .where(eq(entries.id, entryId))
    .limit(1);
  if (!entry) throw new AppError("Öge bulunamadı.");
  // Activity rows keep the name as it reads now: "Stalker (İz Sürücü)".
  const title = formatTitle(entry.media);
  return { entry: { ...entry, title }, ...(await requireChallengeAccess(entry.challengeId, userId)) };
}

/** Finishing something that went into a round that is already over counts from the round's last day. */
const finishedOn = (round: { endsOn: string | null }) => (round.endsOn ? fromDayValue(round.endsOn) : new Date());

/** Marks people as finished, keeping their ratings and any earlier start or finish date. */
async function markFinished(tx: Transaction, entryId: string, userIds: readonly string[], at: Date): Promise<void> {
  if (userIds.length === 0) return;
  await tx
    .insert(entryProgress)
    .values(userIds.map((userId) => ({ entryId, userId, status: "completed" as const, startedAt: at, completedAt: at })))
    .onConflictDoUpdate({
      target: [entryProgress.entryId, entryProgress.userId],
      set: {
        status: "completed",
        startedAt: sql`coalesce(${qualified(entryProgress.startedAt)}, excluded.started_at)`,
        completedAt: sql`coalesce(${qualified(entryProgress.completedAt)}, excluded.completed_at)`,
      },
    });
}

/** Looks up the assignees' own progress on an entry. */
async function assigneeStatuses(executor: Executor, entryId: string, assignees: readonly string[]) {
  if (assignees.length === 0) return () => null;
  const rows = await executor
    .select({ userId: entryProgress.userId, status: entryProgress.status })
    .from(entryProgress)
    .where(and(eq(entryProgress.entryId, entryId), inArray(entryProgress.userId, [...assignees])));
  return (userId: string) => rows.find((row) => row.userId === userId)?.status ?? null;
}

export type SuggestInput = {
  challengeId: string;
  media: MediaInput;
  recipientId: string | null;
  pitch: string | null;
  /** Lists with planning: put it into round `roundIndex` ("plan") or leave it as a suggestion. */
  plan?: { mode: "plan" | "suggest"; roundIndex: number | null };
  /**
   * Lists without planning: the round it goes into when not the current one (a pool list's pool when
   * absent): one that is over, or on a calendar one that hasn't started.
   */
  roundIndex?: number | null;
  /** Group admins: the participant the item is credited to (default: the person adding it). */
  as?: string | null;
  /**
   * Who already finished an item that goes into a round that is over (default: everyone), or one
   * added as "Tur dışı" (default: the person it is credited to).
   */
  finished?: FinishedChoice;
  /** "Tur dışı": into no round, each person finishes it on their own time (any kind of list). */
  offRound?: boolean;
};

const acceptsType = (challenge: { mediaTypes: string[] }, mediaType: string) =>
  challenge.mediaTypes.length === 0 || challenge.mediaTypes.includes(mediaType);

/** One addition per list at a time, so two people can't add the same item at once. */
async function lockForAddition(tx: Transaction, challengeId: string, media: ResolvedMedia): Promise<void> {
  await tx.select({ id: challenges.id }).from(challenges).where(eq(challenges.id, challengeId)).for("update");
  const [duplicate] = await tx
    .select({ id: entries.id })
    .from(entries)
    .innerJoin(workflowStates, eq(workflowStates.id, entries.stateId))
    .where(and(eq(entries.challengeId, challengeId), eq(entries.mediaItemId, media.id), ne(workflowStates.category, "dropped")))
    .limit(1);
  if (duplicate) throw new AppError(`“${formatTitle(media)}” zaten bu listede.`);
}

/**
 * Adds an item as the list's rule allows: a suggestion or a planned item (planning lists), a pool
 * candidate, or an item in a round: the current one, one that is over (filled in afterwards), or on a
 * calendar one that hasn't started. Group admins may add it for another participant (`as`), as if that
 * person had added it and its recipient had accepted it (see domain/additions.ts).
 */
export async function suggestEntry(userId: string, input: SuggestInput): Promise<string> {
  const { challenge, isParticipant, isAdmin } = await requireChallengeAccess(input.challengeId, userId);
  if (!acceptsType(challenge, input.media.mediaType)) throw new AppError("Bu liste bu içerik türünü kabul etmiyor.");
  if (challenge.status !== "active") throw new AppError("Liste şu an aktif değil.");

  await syncRounds([challenge]);
  const creditedId = input.as ?? userId;
  const onBehalf = creditedId !== userId;
  const participants = await activeParticipants(challenge.id);
  const may = canAddAs({
    actorId: userId,
    creditedId,
    actorIsParticipant: isParticipant,
    creditedIsParticipant: participants.some((participant) => participant.userId === creditedId),
    isAdmin,
  });
  if (!may.ok) throw new AppError(may.reason);
  if (input.offRound) return addOffRound(userId, creditedId, challenge, input);

  const rules = planningRules(challenge);
  const strategy = getStrategy(challenge.strategy);
  const poolList = Boolean(strategy.poolRules?.(parseStoredConfig(strategy, challenge.strategyConfig)));
  // Lists without planning: the named round, else the current one (a pool list's pool).
  let target: RoundRef | null = null;
  if (!rules && input.roundIndex !== null && input.roundIndex !== undefined) {
    target = await findRound(db, challenge, input.roundIndex);
    if (!target) throw new AppError("Bu tur bulunamadı.");
  } else if (!rules && !poolList) {
    target = await findCurrentRound(challenge);
  }
  const options = rules ? (await getSuggestionState(challenge, creditedId)).options : await checkTarget(db, challenge, creditedId, target);
  if (!options.allowed) throw new AppError(options.reason);
  if (!options.targets.includes(input.recipientId)) throw new AppError("Bu kişiye şu an öneri yapamazsın.");

  const plannedIndex = rules && input.plan?.mode === "plan" ? input.plan.roundIndex : null;
  if (rules && input.plan?.mode === "plan" && plannedIndex === null) throw new AppError("Bir tur seç.");

  const media = await resolveMediaItem(input.media, userId);
  // A catalog pick carries its own type, so check again after resolving it.
  if (!acceptsType(challenge, media.mediaType)) throw new AppError("Bu liste bu içerik türünü kabul etmiyor.");
  const states = await getChallengeStates(challenge.id);

  return db.transaction(async (tx) => {
    await lockForAddition(tx, challenge.id, media);

    // The round it goes into: a planned one, or the target (created first when it is still ahead).
    // The rule is asked again under the lock, so two additions can't both take the last place.
    let round: { id: string; endsOn: string | null; timing: RoundTiming; label: string } | null = null;
    if (rules && plannedIndex !== null) {
      const slot = await lockSlot(tx, challenge, plannedIndex);
      await assertRoomInRound(tx, slot.round.id, rules);
      round = { id: slot.round.id, endsOn: slot.round.endsOn, timing: slot.timing, label: slot.label };
    } else if (target) {
      if (!target.id) await createRoundsThrough(tx, challenge, target.index);
      const stored = await findRound(tx, challenge, target.index);
      const again = stored?.id ? await checkTarget(tx, challenge, creditedId, stored) : null;
      if (!stored?.id || !again) throw new AppError("Bu tur bulunamadı.");
      if (!again.allowed) throw new AppError(again.reason);
      if (!again.targets.includes(input.recipientId)) throw new AppError("Bu kişiye şu an öneri yapamazsın.");
      round = { id: stored.id, endsOn: stored.endsOn, timing: stored.timing, label: stored.label };
    }

    // How it starts. A round that is over also says who had finished it: the item is done once
    // everyone it is meant for had (a new entry has no other progress yet).
    const ruleCategory = rules ? (round ? "active" : "pending") : options.initialCategory;
    let state = initialState(states, startingCategory({ timing: round?.timing ?? null, onBehalf, ruleCategory }));
    let finished: { choice: FinishedChoice; userIds: string[] } | null = null;
    if (round?.timing === "past") {
      const choice = input.finished ?? "all";
      const assignees = assigneesOf(input.recipientId, await activeParticipants(challenge.id, tx));
      const userIds = finishedBy(choice, assignees, userId).filter((id) => assignees.includes(id));
      finished = { choice, userIds };
      if (progressOutcome(assignees, (id) => (userIds.includes(id) ? "completed" : null)) === "done") {
        state = firstStateIn(states, "done") ?? state;
      }
    }

    const [entry] = await tx
      .insert(entries)
      .values({
        challengeId: challenge.id,
        roundId: round?.id ?? null,
        mediaItemId: media.id,
        stateId: state.id,
        suggestedBy: creditedId,
        suggestedFor: input.recipientId,
        pitch: input.pitch,
      })
      .returning({ id: entries.id });
    if (round && finished) await markFinished(tx, entry.id, finished.userIds, finishedOn(round));

    const people = await tx
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, [creditedId, ...(input.recipientId ? [input.recipientId] : [])]));
    const nameOf = (id: string | null) => (id ? (people.find((person) => person.id === id)?.name ?? null) : null);
    const title = formatTitle(media);
    const as = onBehalf ? nameOf(creditedId) : null;
    const base = { groupId: challenge.groupId, challengeId: challenge.id, entryId: entry.id, actorId: userId };
    if (rules && round) {
      await logActivity(tx, { ...base, type: "entry.planned", data: { title, round: round.label, finished: finished?.choice ?? null, as } });
    } else if (round && (round.timing === "past" || onBehalf || poolList)) {
      // Filled in afterwards, for someone else, or straight into a pool round: whose it is, for whom.
      await logActivity(tx, {
        ...base,
        type: "entry.recorded",
        data: { title, round: round.label, picker: nameOf(creditedId), recipient: nameOf(input.recipientId), finished: finished?.choice ?? null },
      });
    } else {
      await logActivity(tx, {
        ...base,
        type: "entry.suggested",
        data: {
          title,
          recipientName: nameOf(input.recipientId),
          pool: options.placement === "pool",
          round: round?.timing === "future" ? round.label : null,
          as,
        },
      });
    }
    return entry.id;
  });
}

/** The state a "Tur dışı" item is in while people are on it: the workflow's first "active" step. */
function offRoundState<T extends { category: StateCategory; position: number }>(states: readonly T[]): T {
  const state = firstStateIn(states, "active");
  if (!state) throw new AppError("Bu listenin durum akışında “Sürüyor” türünde bir adım yok; öge tur dışına alınamaz.");
  return state;
}

/**
 * "Tur dışı": an item outside the rounds, for everyone taking part, each on their own time. The list's
 * rule (limits, turns, the pool) doesn't apply, since nothing goes into a round. Usually someone has
 * already finished it, which `finished` says (default: the person it is credited to).
 */
async function addOffRound(
  userId: string,
  creditedId: string,
  challenge: Awaited<ReturnType<typeof requireChallengeAccess>>["challenge"],
  input: SuggestInput,
): Promise<string> {
  const media = await resolveMediaItem(input.media, userId);
  if (!acceptsType(challenge, media.mediaType)) throw new AppError("Bu liste bu içerik türünü kabul etmiyor.");
  const states = await getChallengeStates(challenge.id);
  const active = offRoundState(states);

  return db.transaction(async (tx) => {
    await lockForAddition(tx, challenge.id, media);
    const assignees = assigneesOf(null, await activeParticipants(challenge.id, tx));
    const choice = input.finished ?? "me";
    const userIds = finishedBy(choice, assignees, creditedId).filter((id) => assignees.includes(id));
    const done = progressOutcome(assignees, (id) => (userIds.includes(id) ? "completed" : null)) === "done";
    const state = done ? (firstStateIn(states, "done") ?? active) : active;

    const [entry] = await tx
      .insert(entries)
      .values({
        challengeId: challenge.id,
        roundId: null,
        mediaItemId: media.id,
        stateId: state.id,
        suggestedBy: creditedId,
        suggestedFor: null,
        pitch: input.pitch,
      })
      .returning({ id: entries.id });
    await markFinished(tx, entry.id, userIds, new Date());

    const [credited] = creditedId !== userId ? await tx.select({ name: users.name }).from(users).where(eq(users.id, creditedId)) : [];
    await logActivity(tx, {
      groupId: challenge.groupId,
      challengeId: challenge.id,
      entryId: entry.id,
      actorId: userId,
      type: "entry.suggested",
      data: { title: formatTitle(media), offRound: true, finished: userIds.length > 0 ? choice : null, as: credited?.name ?? null },
    });
    return entry.id;
  });
}

/** How far past the chosen round a batch may spill when rounds fill up (open-ended lists). */
const MAX_SPILL_ROUNDS = 240;

/**
 * Adds several picked items in one go, each on its own (one failing doesn't stop the rest).
 * When planning into a round that holds a limited number of items, the batch fills the chosen
 * round and then the following rounds with room, in order: three books from "Ocak–Mart" land in
 * the first three free quarters.
 */
export async function suggestEntries(
  userId: string,
  input: Omit<SuggestInput, "media"> & { items: { key: string; label: string; media: MediaInput }[] },
): Promise<BatchResult> {
  const result: BatchResult = { added: [], ids: [], failed: [] };
  let roundIndex = input.plan?.mode === "plan" ? input.plan.roundIndex : null;
  const lastIndex = roundIndex === null ? null : roundIndex + MAX_SPILL_ROUNDS;

  for (const item of input.items) {
    for (;;) {
      try {
        const entryId = await suggestEntry(userId, {
          ...input,
          media: item.media,
          plan: input.plan ? { mode: input.plan.mode, roundIndex } : undefined,
        });
        result.added.push(item.key);
        result.ids.push(entryId);
        break;
      } catch (error) {
        if (error instanceof RoundFullError && roundIndex !== null && lastIndex !== null && roundIndex < lastIndex) {
          roundIndex += 1;
          continue;
        }
        if (!(error instanceof AppError)) throw error;
        // Spilling past the list's last round means every later round is full.
        const spilled = roundIndex !== (input.plan?.roundIndex ?? null);
        const message = error instanceof PastLastRoundError && spilled ? "Planda boş tur kalmadı." : error.message;
        result.failed.push({ key: item.key, label: item.label, message });
        break;
      }
    }
  }
  return result;
}

/**
 * Removes an item added by mistake, with its notes, ratings and votes. The person who added it,
 * the list's creator and group admins may do this.
 */
export async function deleteEntry(userId: string, entryId: string): Promise<string> {
  const { entry, challenge, canManage } = await loadEntryContext(entryId, userId);
  if (!canDeleteEntry({ actorId: userId, suggestedBy: entry.suggestedBy, canManage })) {
    throw new AppError("Bu ögeyi yalnızca ekleyen kişi, listeyi kuran ya da grup yöneticileri silebilir.");
  }
  await db.transaction(async (tx) => {
    await tx.delete(entries).where(eq(entries.id, entry.id));
    // The entry's own history goes with it (cascade), so this event isn't tied to the entry.
    await logActivity(tx, {
      groupId: challenge.groupId,
      challengeId: challenge.id,
      actorId: userId,
      type: "entry.deleted",
      data: { title: entry.title },
    });
  });
  return challenge.id;
}

/**
 * Planning lists: accepts a suggestion into round `roundIndex`, or moves a planned item there.
 * Moving never changes whether an item is done. Into a round that is already over, `finished`
 * says who finished it; the item is done once everyone it is meant for has.
 */
export async function placeEntry(userId: string, entryId: string, roundIndex: number, finished: FinishedChoice = "all"): Promise<void> {
  const { entry, challenge, isParticipant, isAdmin } = await loadEntryContext(entryId, userId);
  const rules = planningRules(challenge);
  if (!rules) throw new AppError("Bu listede turlar elle doldurulmuyor.");
  if (challenge.status !== "active") throw new AppError("Liste şu an aktif değil.");
  if (entry.category === "dropped") throw new AppError("Elenen bir ögeyi plana almadan önce durumunu geri al.");

  const place = placeOf(entry);
  const isSuggestion = place === "waiting";
  if (isSuggestion) {
    const participantCount = (await activeParticipants(challenge.id)).length;
    const allowed = canAcceptSuggestion({
      actorId: userId,
      suggestedBy: entry.suggestedBy,
      isParticipant,
      isGroupAdmin: isAdmin,
      participantCount,
    });
    if (!allowed) {
      throw new AppError(isParticipant ? "Kendi önerini listedeki başka biri kabul etmeli." : "Plana eklemek için listeye katılmalısın.");
    }
  } else if (!isParticipant && !isAdmin) {
    throw new AppError("Planı yalnızca listenin katılımcıları değiştirebilir.");
  }

  const states = await getChallengeStates(challenge.id);
  await db.transaction(async (tx) => {
    const slot = await lockSlot(tx, challenge, roundIndex);
    if (slot.round.id === entry.roundId) return;
    await assertRoomInRound(tx, slot.round.id, rules, entry.id);

    let category: StateCategory | null = isSuggestion ? "active" : null;
    let choice: FinishedChoice | null = null;
    if (slot.timing === "past" && entry.category !== "done") {
      const assignees = assigneesOf(entry.suggestedFor, await activeParticipants(challenge.id, tx));
      const userIds = finishedBy(finished, assignees, userId);
      if (userIds.length > 0) {
        choice = finished;
        await markFinished(tx, entry.id, userIds, finishedOn(slot.round));
        if (progressOutcome(assignees, await assigneeStatuses(tx, entry.id, assignees)) === "done") category = "done";
      }
    }
    const state = category && category !== entry.category ? firstStateIn(states, category) : undefined;
    await tx
      .update(entries)
      .set({ roundId: slot.round.id, ...(state ? { stateId: state.id, stateChangedAt: new Date() } : {}) })
      .where(eq(entries.id, entry.id));
    await logActivity(tx, {
      groupId: challenge.groupId,
      challengeId: challenge.id,
      entryId: entry.id,
      actorId: userId,
      type: isSuggestion ? "entry.planned" : "entry.moved",
      data: { title: entry.title, round: slot.label, accepted: isSuggestion, finished: choice, fromOffRound: place === "off" },
    });
  });
}

/** Planning lists: takes an item out of its round and back to the suggestions. */
export async function unplanEntry(userId: string, entryId: string): Promise<void> {
  const { entry, challenge, isParticipant, isAdmin } = await loadEntryContext(entryId, userId);
  if (!planningRules(challenge)) throw new AppError("Bu listede turlar elle doldurulmuyor.");
  if (!isParticipant && !isAdmin) throw new AppError("Planı yalnızca listenin katılımcıları değiştirebilir.");
  if (entry.roundId === null) return;

  const pending = initialState(await getChallengeStates(challenge.id), "pending");
  await db.transaction(async (tx) => {
    await tx
      .update(entries)
      .set({ roundId: null, stateId: pending.id, stateChangedAt: new Date() })
      .where(eq(entries.id, entry.id));
    await logActivity(tx, {
      groupId: challenge.groupId,
      challengeId: challenge.id,
      entryId: entry.id,
      actorId: userId,
      type: "entry.unplanned",
      data: { title: entry.title },
    });
  });
}

export async function changeEntryState(userId: string, entryId: string, stateId: string): Promise<void> {
  const { entry, challenge, isParticipant, isAdmin } = await loadEntryContext(entryId, userId);
  const states = await getChallengeStates(challenge.id);
  const target = states.find((state) => state.id === stateId);
  if (!target) throw new AppError("Geçersiz durum.");
  if (target.id === entry.stateId) return;

  const allowed = canChangeState({
    actorId: userId,
    suggestedBy: entry.suggestedBy,
    suggestedFor: entry.suggestedFor,
    currentCategory: entry.category,
    targetCategory: target.category,
    isParticipant,
    isGroupAdmin: isAdmin,
  });
  if (!allowed) throw new AppError("Bu ögenin durumunu değiştirme yetkin yok.");
  if (planningRules(challenge) && !isPlanStateChangeAllowed({ inRound: entry.roundId !== null, targetCategory: target.category })) {
    throw new AppError(
      entry.roundId === null ? "Öneriyi kabul etmek için onu bir tura yerleştir." : "Ögeyi önerilere geri almak için “Önerilere geri al”ı kullan.",
    );
  }

  await db.transaction(async (tx) => {
    await tx.update(entries).set({ stateId: target.id, stateChangedAt: new Date() }).where(eq(entries.id, entry.id));
    await logActivity(tx, {
      groupId: challenge.groupId,
      challengeId: challenge.id,
      entryId: entry.id,
      actorId: userId,
      type: "entry.state_changed",
      data: { title: entry.title, from: entry.stateLabel, to: target.label },
    });
  });
}

export type ProgressResult = {
  /** The status they had before (null: none), for "Geri al". */
  previous: ProgressStatus | null;
  /** The change took a pool candidate out of the pool, to "Tur dışı". */
  leftPool: boolean;
};

/**
 * Saves the user's own status and/or rating. `backToPool` is the "Geri al" of a change that took a
 * pool candidate out of the pool: with the status put back, the item returns to the pool too.
 */
export async function updateProgress(
  userId: string,
  entryId: string,
  patch: { status?: ProgressStatus; rating?: number | null },
  options: { backToPool?: boolean } = {},
): Promise<ProgressResult> {
  const { entry, challenge } = await loadEntryContext(entryId, userId);
  const now = new Date();

  const [existing] = await db
    .select()
    .from(entryProgress)
    .where(and(eq(entryProgress.entryId, entry.id), eq(entryProgress.userId, userId)))
    .limit(1);

  const status = patch.status ?? existing?.status ?? "planned";
  const rating = patch.rating !== undefined ? patch.rating : (existing?.rating ?? null);
  const justCompleted = status === "completed" && existing?.status !== "completed";
  const values = {
    status,
    rating,
    startedAt: existing?.startedAt ?? (status === "in_progress" || status === "completed" ? now : null),
    completedAt: status === "completed" ? (justCompleted ? now : (existing?.completedAt ?? now)) : null,
  };

  await db
    .insert(entryProgress)
    .values({ entryId: entry.id, userId, ...values })
    .onConflictDoUpdate({ target: [entryProgress.entryId, entryProgress.userId], set: values });

  const statusChanged = patch.status !== undefined && patch.status !== (existing?.status ?? "planned");
  const ratingChanged = patch.rating !== undefined && patch.rating !== (existing?.rating ?? null);
  if (statusChanged || ratingChanged) {
    await logActivity(db, {
      groupId: challenge.groupId,
      challengeId: challenge.id,
      entryId: entry.id,
      actorId: userId,
      type: "progress.updated",
      data: { title: entry.title, status: statusChanged ? status : null, rating: ratingChanged ? rating : null },
    });
  }

  const previous = existing?.status ?? null;
  if (!statusChanged) return { previous, leftPool: false };

  // The entry is done once everyone it is meant for has finished it, and open again when one of
  // them takes their "finished" back (a planning list's suggestion waits for a round first). A pool
  // candidate someone finished alone leaves the pool; a "Tur dışı" item nobody will finish is dropped.
  const place = placeOf(entry);
  const pool = poolRulesOf(challenge) !== null;
  const assignees = assigneesOf(entry.suggestedFor, await activeParticipants(challenge.id));
  const statusOf = await assigneeStatuses(db, entry.id, assignees);
  const target = stateAfterProgress({
    place,
    category: entry.category,
    planning: planningRules(challenge) !== null,
    pool,
    outcome: progressOutcome(assignees, statusOf),
    gaveUp: everyoneGaveUp(assignees, statusOf),
    actorIsAssignee: assignees.includes(userId),
    actorWasSettled: isSettled(previous),
    actorIsSettled: isSettled(status),
  });
  const states = await getChallengeStates(challenge.id);
  const base = { groupId: challenge.groupId, challengeId: challenge.id, entryId: entry.id };

  if (!target && options.backToPool && pool && place === "off" && entry.category === "active") {
    const pending = initialState(states, "pending");
    await db.transaction(async (tx) => {
      await tx.update(entries).set({ stateId: pending.id, stateChangedAt: now }).where(eq(entries.id, entry.id));
      await logActivity(tx, { ...base, actorId: userId, type: "entry.back_from_off_round", data: { title: entry.title, to: "pool" } });
    });
    return { previous, leftPool: false };
  }
  if (!target) return { previous, leftPool: false };

  const next =
    target === "done" ? firstStateIn(states, "done") : target === "dropped" ? firstStateIn(states, "dropped") : initialState(states, "active");
  if (!next || next.id === entry.stateId) return { previous, leftPool: false };
  const leftPool = place === "waiting" && next.category === "active";
  await db.transaction(async (tx) => {
    await tx.update(entries).set({ stateId: next.id, stateChangedAt: now }).where(eq(entries.id, entry.id));
    await logActivity(
      tx,
      leftPool
        ? { ...base, actorId: null, type: "entry.off_round", data: { title: entry.title, from: "pool", automatic: true, by: userId } }
        : {
            ...base,
            actorId: null,
            type: "entry.state_changed",
            data: {
              title: entry.title,
              from: entry.stateLabel,
              to: next.label,
              automatic: true,
              // Whose change set it off: they aren't notified about what they caused.
              by: userId,
              reopened: target === "active",
              gaveUp: target === "dropped",
            },
          },
    );
  });
  return { previous, leftPool };
}

/** Where an item was before it was taken out of the rounds, for "Geri al". */
export type Placement = { roundId: string | null; stateId: string };

async function roundLabelOf(challenge: Parameters<typeof roundLabel>[0], roundId: string | null, executor: Executor = db) {
  if (!roundId) return null;
  const [round] = await executor
    .select({ index: rounds.index, startsOn: rounds.startsOn, endsOn: rounds.endsOn })
    .from(rounds)
    .where(eq(rounds.id, roundId))
    .limit(1);
  return round ? roundLabel(challenge, round) : null;
}

/**
 * Takes an item out of its round (or out of the pool / the suggestions) to "Tur dışı": it stays in the
 * list, nobody waits for a round to do it, and each person finishes it on their own time. A pending
 * item counts as taken on. Returns where it was, so "Geri al" can put it back.
 */
export async function takeOffRound(userId: string, entryId: string): Promise<Placement> {
  const { entry, challenge, isParticipant, isAdmin } = await loadEntryContext(entryId, userId);
  if (challenge.status !== "active") throw new AppError("Liste şu an aktif değil.");
  const place = placeOf(entry);
  if (place === "off") throw new AppError("Öge zaten tur dışında.");
  if (place === "dropped") throw new AppError("Elenen bir ögeyi tur dışına almadan önce durumunu geri al.");
  const allowed = canTakeOffRound({
    actorId: userId,
    suggestedBy: entry.suggestedBy,
    suggestedFor: entry.suggestedFor,
    place,
    category: entry.category,
    isParticipant,
    isGroupAdmin: isAdmin,
  });
  if (!allowed) throw new AppError("Bu ögeyi tur dışına alma yetkin yok.");

  const states = await getChallengeStates(challenge.id);
  const active = entry.category === "pending" ? offRoundState(states) : null;
  const round = await roundLabelOf(challenge, entry.roundId);
  const from = place === "round" ? "round" : poolRulesOf(challenge) ? "pool" : "suggestions";
  await db.transaction(async (tx) => {
    await tx
      .update(entries)
      .set({ roundId: null, ...(active ? { stateId: active.id, stateChangedAt: new Date() } : {}) })
      .where(eq(entries.id, entry.id));
    await logActivity(tx, {
      groupId: challenge.groupId,
      challengeId: challenge.id,
      entryId: entry.id,
      actorId: userId,
      type: "entry.off_round",
      data: { title: entry.title, from, round },
    });
  });
  return { roundId: entry.roundId, stateId: entry.stateId };
}

/**
 * Back from "Tur dışı": to `to`, where it was just before ("Geri al"), or else, while it is still
 * open, to the pool of a pool list or the suggestions of a planning list.
 */
export async function returnFromOffRound(userId: string, entryId: string, to?: Placement): Promise<void> {
  const { entry, challenge, isParticipant, isAdmin } = await loadEntryContext(entryId, userId);
  if (challenge.status !== "active") throw new AppError("Liste şu an aktif değil.");
  if (placeOf(entry) !== "off") throw new AppError("Öge tur dışında değil.");
  if (!isParticipant && !isAdmin && entry.suggestedBy !== userId) throw new AppError("Bu ögeyi geri alma yetkin yok.");

  const states = await getChallengeStates(challenge.id);
  const planning = planningRules(challenge);
  const pool = poolRulesOf(challenge);
  const waiting = waitingPlaceOf({ pool: pool !== null, planning: planning !== null });
  let target: Placement;
  if (to) {
    const state = states.find((candidate) => candidate.id === to.stateId);
    const fits = state && state.category !== "dropped" && (to.roundId !== null ? true : state.category === "pending" && waiting !== null);
    if (!fits) throw new AppError("Öge eski yerine alınamadı.");
    target = to;
  } else {
    if (!waiting) throw new AppError("Bu listede tur dışı bir öge yalnızca hemen “Geri al” ile turuna dönebilir.");
    if (entry.category !== "active") throw new AppError("Biten bir öge geri alınamaz.");
    target = { roundId: null, stateId: initialState(states, "pending").id };
  }

  await db.transaction(async (tx) => {
    let round: string | null = null;
    if (target.roundId) {
      const [row] = await tx
        .select({ id: rounds.id })
        .from(rounds)
        .where(and(eq(rounds.id, target.roundId), eq(rounds.challengeId, challenge.id)))
        .limit(1);
      if (!row) throw new AppError("Öge eski yerine alınamadı.");
      // The place it left may have been taken meanwhile.
      if (planning) await assertRoomInRound(tx, row.id, planning, entry.id);
      if (pool && (await roomInPoolRound(tx, row.id, pool.picksPerRound)) <= 0) throw new AppError("Bu turun seçimi artık dolu.");
      round = await roundLabelOf(challenge, row.id, tx);
    }
    await tx
      .update(entries)
      .set({
        roundId: target.roundId,
        stateId: target.stateId,
        ...(target.stateId !== entry.stateId ? { stateChangedAt: new Date() } : {}),
      })
      .where(eq(entries.id, entry.id));
    await logActivity(tx, {
      groupId: challenge.groupId,
      challengeId: challenge.id,
      entryId: entry.id,
      actorId: userId,
      type: "entry.back_from_off_round",
      data: { title: entry.title, to: target.roundId ? "round" : waiting, round },
    });
  });
}

/** Moves the user's own finish to the day it really happened (they marked it later). */
export async function setFinishedOn(userId: string, entryId: string, day: Date): Promise<void> {
  const { entry } = await loadEntryContext(entryId, userId);
  const mine = and(eq(entryProgress.entryId, entry.id), eq(entryProgress.userId, userId));
  const [existing] = await db
    .select({ status: entryProgress.status, startedAt: entryProgress.startedAt })
    .from(entryProgress)
    .where(mine)
    .limit(1);
  if (existing?.status !== "completed") throw new AppError("Önce bitirdiğini işaretle.");
  await db.update(entryProgress).set(finishOnDay(existing, day)).where(mine);
}

export async function addNote(
  userId: string,
  entryId: string,
  input: { body: string; visibility: "private" | "shared"; isSpoiler: boolean },
): Promise<void> {
  const { entry, challenge } = await loadEntryContext(entryId, userId);
  await db.insert(notes).values({ entryId: entry.id, authorId: userId, ...input });
  if (input.visibility === "shared") {
    await logActivity(db, {
      groupId: challenge.groupId,
      challengeId: challenge.id,
      entryId: entry.id,
      actorId: userId,
      type: "note.added",
      data: { title: entry.title },
    });
  }
}

export async function deleteNote(userId: string, noteId: string): Promise<void> {
  if (!isUuid(noteId)) throw new AppError("Not bulunamadı.");
  const deleted = await db
    .delete(notes)
    .where(and(eq(notes.id, noteId), eq(notes.authorId, userId)))
    .returning({ id: notes.id });
  if (deleted.length === 0) throw new AppError("Yalnızca kendi notlarını silebilirsin.");
}

export async function toggleVote(userId: string, entryId: string): Promise<void> {
  const { entry, isParticipant } = await loadEntryContext(entryId, userId);
  if (!isParticipant) throw new AppError("Oy vermek için listeye katılmalısın.");
  if (entry.roundId !== null || entry.category !== "pending") throw new AppError("Bu öge artık oylamada değil.");

  const removed = await db
    .delete(entryVotes)
    .where(and(eq(entryVotes.entryId, entry.id), eq(entryVotes.userId, userId)))
    .returning({ entryId: entryVotes.entryId });
  if (removed.length === 0) {
    await db.insert(entryVotes).values({ entryId: entry.id, userId }).onConflictDoNothing();
  }
}
