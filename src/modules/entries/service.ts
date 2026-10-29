import "server-only";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db, type Executor, type Transaction } from "@/db";
import { challenges, entries, entryProgress, entryVotes, mediaItems, notes, users, workflowStates } from "@/db/schema";
import { qualified } from "@/db/sql";
import { AppError, type BatchResult } from "@/lib/action-state";
import { fromDayValue } from "@/lib/short-date";
import { isUuid } from "@/lib/utils";
import { logActivity } from "@/modules/activity/service";
import { requireChallengeAccess } from "@/modules/challenges/context";
import { canAcceptSuggestion, isPlanStateChangeAllowed } from "@/modules/challenges/domain/plan";
import { assertRoomInRound, lockSlot, PastLastRoundError, planningRules, RoundFullError } from "@/modules/challenges/planning";
import { activeParticipants, syncRounds, type RoundRow } from "@/modules/challenges/rounds";
import { getSuggestionState } from "@/modules/challenges/suggestions";
import { resolveMediaItem, type MediaInput } from "@/modules/media/service";
import { titleColumns } from "@/modules/media/columns";
import { formatTitle } from "@/modules/media/titles";
import { canChangeState, firstStateIn, initialState, type StateCategory } from "@/modules/workflows/domain";
import { getChallengeStates } from "@/modules/workflows/queries";
import { canDeleteEntry } from "./domain";
import type { ProgressStatus } from "./labels";
import {
  assigneesOf,
  finishedBy,
  isSettled,
  progressOutcome,
  stateAfterProgress,
  type FinishedChoice,
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
const finishedOn = (round: RoundRow) => (round.endsOn ? fromDayValue(round.endsOn) : new Date());

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
  /** Who already finished an item planned into a round that is over (default: everyone). */
  finished?: FinishedChoice;
};

const acceptsType = (challenge: { mediaTypes: string[] }, mediaType: string) =>
  challenge.mediaTypes.length === 0 || challenge.mediaTypes.includes(mediaType);

export async function suggestEntry(userId: string, input: SuggestInput): Promise<string> {
  const { challenge } = await requireChallengeAccess(input.challengeId, userId);
  if (!acceptsType(challenge, input.media.mediaType)) throw new AppError("Bu liste bu içerik türünü kabul etmiyor.");

  await syncRounds([challenge]);
  const { options, round } = await getSuggestionState(challenge, userId);
  if (!options.allowed) throw new AppError(options.reason);
  if (!options.targets.includes(input.recipientId)) throw new AppError("Bu kişiye şu an öneri yapamazsın.");

  const rules = options.placement === "plan" ? planningRules(challenge) : null;
  const plannedIndex = rules && input.plan?.mode === "plan" ? input.plan.roundIndex : null;
  if (rules && input.plan?.mode === "plan" && plannedIndex === null) throw new AppError("Bir tur seç.");

  const media = await resolveMediaItem(input.media, userId);
  // A catalog pick carries its own type, so check again after resolving it.
  if (!acceptsType(challenge, media.mediaType)) throw new AppError("Bu liste bu içerik türünü kabul etmiyor.");
  const states = await getChallengeStates(challenge.id);

  return db.transaction(async (tx) => {
    // One addition per list at a time, so two people can't add the same item at once.
    await tx.select({ id: challenges.id }).from(challenges).where(eq(challenges.id, challenge.id)).for("update");
    const [duplicate] = await tx
      .select({ id: entries.id })
      .from(entries)
      .innerJoin(workflowStates, eq(workflowStates.id, entries.stateId))
      .where(and(eq(entries.challengeId, challenge.id), eq(entries.mediaItemId, media.id), ne(workflowStates.category, "dropped")))
      .limit(1);
    if (duplicate) throw new AppError(`“${formatTitle(media)}” zaten bu listede.`);

    let roundId = options.placement === "round" ? (round?.id ?? null) : null;
    let state = initialState(states, options.initialCategory);
    let slotLabel: string | null = null;
    let finished: { choice: FinishedChoice; userIds: string[]; at: Date } | null = null;
    if (rules && plannedIndex !== null) {
      const slot = await lockSlot(tx, challenge, plannedIndex);
      await assertRoomInRound(tx, slot.round.id, rules);
      roundId = slot.round.id;
      state = initialState(states, "active");
      slotLabel = slot.label;
      // A round that is over doesn't make the item done; whoever finished it does.
      if (slot.timing === "past") {
        const choice = input.finished ?? "all";
        const assignees = assigneesOf(input.recipientId, await activeParticipants(challenge.id, tx));
        const userIds = finishedBy(choice, assignees, userId);
        finished = { choice, userIds, at: finishedOn(slot.round) };
        // A new entry has no other progress yet.
        if (progressOutcome(assignees, (id) => (userIds.includes(id) ? "completed" : null)) === "done") {
          state = firstStateIn(states, "done") ?? state;
        }
      }
    }

    const [entry] = await tx
      .insert(entries)
      .values({
        challengeId: challenge.id,
        roundId,
        mediaItemId: media.id,
        stateId: state.id,
        suggestedBy: userId,
        suggestedFor: input.recipientId,
        pitch: input.pitch,
      })
      .returning({ id: entries.id });

    if (slotLabel) {
      if (finished) await markFinished(tx, entry.id, finished.userIds, finished.at);
      await logActivity(tx, {
        groupId: challenge.groupId,
        challengeId: challenge.id,
        entryId: entry.id,
        actorId: userId,
        type: "entry.planned",
        data: { title: formatTitle(media), round: slotLabel, finished: finished?.choice ?? null },
      });
      return entry.id;
    }

    const [recipient] = input.recipientId
      ? await tx.select({ name: users.name }).from(users).where(eq(users.id, input.recipientId)).limit(1)
      : [];
    await logActivity(tx, {
      groupId: challenge.groupId,
      challengeId: challenge.id,
      entryId: entry.id,
      actorId: userId,
      type: "entry.suggested",
      data: { title: formatTitle(media), recipientName: recipient?.name ?? null, pool: options.placement === "pool" },
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

  const isSuggestion = entry.roundId === null;
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
      data: { title: entry.title, round: slot.label, accepted: isSuggestion, finished: choice },
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

/** Saves the user's own status and/or rating; returns the status they had before (null: none). */
export async function updateProgress(
  userId: string,
  entryId: string,
  patch: { status?: ProgressStatus; rating?: number | null },
): Promise<ProgressStatus | null> {
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
  if (!statusChanged) return previous;

  // The entry is done once everyone it is meant for has finished it, and open again when one of
  // them takes their "finished" back. (A planning list's suggestion waits for a round first.)
  const assignees = assigneesOf(entry.suggestedFor, await activeParticipants(challenge.id));
  const target = stateAfterProgress({
    category: entry.category,
    tracked: entry.roundId !== null || planningRules(challenge) === null,
    outcome: progressOutcome(assignees, await assigneeStatuses(db, entry.id, assignees)),
    actorIsAssignee: assignees.includes(userId),
    actorWasSettled: isSettled(previous),
    actorIsSettled: isSettled(status),
  });
  if (!target) return previous;
  const states = await getChallengeStates(challenge.id);
  const next = target === "done" ? firstStateIn(states, "done") : initialState(states, "active");
  if (next && next.id !== entry.stateId) {
    await db.transaction(async (tx) => {
      await tx.update(entries).set({ stateId: next.id, stateChangedAt: now }).where(eq(entries.id, entry.id));
      await logActivity(tx, {
        groupId: challenge.groupId,
        challengeId: challenge.id,
        entryId: entry.id,
        actorId: null,
        type: "entry.state_changed",
        data: { title: entry.title, from: entry.stateLabel, to: next.label, automatic: true, reopened: target === "active" },
      });
    });
  }
  return previous;
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
