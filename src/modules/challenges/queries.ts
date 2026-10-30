import "server-only";
import { and, asc, count, eq, inArray, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { entries, groupMembers, groups, mediaItems, mediaTypes, roundAssignments, users, workflowStates } from "@/db/schema";
import { isUuid } from "@/lib/utils";
import { groupAudience, type FinishedAudience } from "@/modules/entries/labels";
import { loadEntryCards, type EntryCard } from "@/modules/entries/queries";
import type { RoundTiming } from "@/modules/entries/tracking";
import { getMembership } from "@/modules/groups/service";
import { listMyPicks } from "@/modules/lists/queries";
import { titleColumns } from "@/modules/media/columns";
import { describeExisting } from "@/modules/media/keys";
import { listMediaTypes } from "@/modules/media/service";
import { formatTitle } from "@/modules/media/titles";
import { firstStateIn } from "@/modules/workflows/domain";
import { getChallengeStates, listWorkflowsForGroup } from "@/modules/workflows/queries";
import { getChallengeAccess, listParticipants } from "./context";
import { todayIn } from "./domain/cadence";
import { canAddAs } from "./domain/additions";
import { canAcceptSuggestion, describeSlotOption } from "./domain/plan";
import type { SuggestionOptions } from "./domain/strategies";
import { buildSlots, loadPlanRounds, loadSlotOptions, toSlotOptions, type SlotOption } from "./planning";
import { syncRounds } from "./rounds";
import { activeParticipantIds, currentSettings } from "./settings";
import { getSuggestionState } from "./suggestions";
import { checkTarget, findCurrentRound, findRound, loadTimeline, selectableRounds, type RoundRef } from "./targets";

const picker = alias(users, "picker");
const assignee = alias(users, "assignee");

/** First round worth suggesting in a picker: the requested one, else the next free upcoming one. */
function defaultSlot(options: SlotOption[], requested?: string): SlotOption | null {
  return (
    options.find((option) => String(option.index) === requested && !option.isFull) ??
    options.find((option) => option.timing !== "past" && !option.isFull) ??
    options.find((option) => !option.isFull) ??
    null
  );
}

export async function getChallengePage(userId: string, challengeId: string) {
  const access = await getChallengeAccess(challengeId, userId);
  if (!access) return null;
  const { challenge } = access;

  await syncRounds([challenge]);
  const suggestion = await getSuggestionState(challenge, userId);
  const { strategy, config, round } = suggestion;
  const today = todayIn(challenge.timezone);

  const [participants, states, cards, roundRows, assignmentRows] = await Promise.all([
    listParticipants(challengeId),
    getChallengeStates(challengeId),
    loadEntryCards(userId, eq(entries.challengeId, challengeId)),
    loadPlanRounds(challengeId),
    round
      ? db
          .select({
            pickerId: roundAssignments.pickerId,
            pickerName: picker.name,
            recipientId: roundAssignments.recipientId,
            recipientName: assignee.name,
          })
          .from(roundAssignments)
          .innerJoin(picker, eq(picker.id, roundAssignments.pickerId))
          .leftJoin(assignee, eq(assignee.id, roundAssignments.recipientId))
          .where(eq(roundAssignments.roundId, round.id))
      : Promise.resolve([]),
  ]);

  const poolRules = strategy.poolRules?.(config) ?? null;
  const planning = strategy.planning?.(config) ?? null;
  const isPoolCandidate = (card: EntryCard) => card.roundId === null && card.state.category === "pending";
  const inPlay = (card: EntryCard) => card.state.category !== "dropped";
  const roundCards = round ? cards.filter((card) => card.roundId === round.id) : [];
  const activeCount = participants.filter((participant) => participant.isActive).length;

  const assignments = assignmentRows.map((assignment) => ({
    ...assignment,
    entries: roundCards.filter(
      (card) =>
        inPlay(card) &&
        card.suggestedBy?.id === assignment.pickerId &&
        (card.suggestedFor?.id ?? null) === assignment.recipientId,
    ),
  }));

  const byOldest = (a: EntryCard, b: EntryCard) => a.createdAt.getTime() - b.createdAt.getTime();
  const filledByRound = new Map<string, number>();
  for (const card of cards) {
    if (card.roundId && inPlay(card)) filledByRound.set(card.roundId, (filledByRound.get(card.roundId) ?? 0) + 1);
  }
  const options = planning ? toSlotOptions(buildSlots(challenge, planning, roundRows, filledByRound, "select")) : [];
  const plan = planning
    ? {
        capacity: planning.itemsPerRound,
        canEdit: access.isParticipant && challenge.status === "active",
        slots: buildSlots(challenge, planning, roundRows, filledByRound, "show").map((slot) => ({
          ...slot,
          entries: slot.roundId ? cards.filter((card) => card.roundId === slot.roundId && inPlay(card)).sort(byOldest) : [],
        })),
        options,
        defaultIndex: defaultSlot(options)?.index ?? null,
        suggestions: cards
          .filter((card) => card.roundId === null && inPlay(card))
          .sort(byOldest)
          .map((card) => ({
            card,
            canAccept:
              challenge.status === "active" &&
              canAcceptSuggestion({
                actorId: userId,
                suggestedBy: card.suggestedBy?.id ?? null,
                isParticipant: access.isParticipant,
                isGroupAdmin: access.isAdmin,
                participantCount: activeCount,
              }),
          })),
        dropped: cards.filter((card) => !inPlay(card)),
        droppedStateId: firstStateIn(states, "dropped")?.id ?? null,
      }
    : null;
  // Lists without planning: their rounds around the current one, and what the viewer may add there.
  const timeline = planning
    ? null
    : await loadTimeline(challenge, {
        roundRows,
        cards,
        participants,
        viewer: { id: userId, isParticipant: access.isParticipant, isAdmin: access.isAdmin },
      });

  return {
    viewerId: userId,
    access,
    challenge,
    strategy: { key: strategy.key, label: strategy.label, summary: strategy.summary, description: strategy.describeConfig(config) },
    suggestion: suggestion.options,
    // Something can be added now: here and now by the list's rule, or into a round ahead.
    addable: suggestion.options.allowed || Boolean(timeline?.upcoming.some((view) => view.canAdd)),
    round,
    roundEntries: roundCards.filter(inPlay),
    // Started rounds only (planning may create future ones early), newest first.
    rounds: roundRows.filter((row) => row.startsOn <= today).reverse(),
    today,
    participants,
    assignments,
    pool: poolRules
      ? {
          rules: poolRules,
          candidates: cards.filter(isPoolCandidate).sort((a, b) => b.votes - a.votes),
          openSlots: round ? Math.max(0, poolRules.picksPerRound - roundCards.filter(inPlay).length) : 0,
        }
      : null,
    plan,
    timeline,
    board: states.map((state) => ({
      state,
      entries: cards.filter((card) => card.state.id === state.id && !(poolRules && isPoolCandidate(card))),
    })),
    entryCount: cards.length,
    titles: Object.fromEntries(cards.map((card) => [card.id, formatTitle(card.media)])),
  };
}

export type ChallengePageData = NonNullable<Awaited<ReturnType<typeof getChallengePage>>>;

export async function getNewChallengeData(userId: string, groupId: string) {
  if (!isUuid(groupId)) return null;
  const membership = await getMembership(groupId, userId);
  if (!membership) return null;

  const [[group], members, types, workflowList] = await Promise.all([
    db.select({ id: groups.id, name: groups.name, timezone: groups.timezone }).from(groups).where(eq(groups.id, groupId)),
    db
      .select({ userId: groupMembers.userId, name: users.name, username: users.username })
      .from(groupMembers)
      .innerJoin(users, eq(users.id, groupMembers.userId))
      .where(eq(groupMembers.groupId, groupId))
      .orderBy(asc(groupMembers.joinedAt)),
    listMediaTypes(),
    listWorkflowsForGroup(groupId),
  ]);
  if (!group) return null;
  return { group, members, mediaTypes: types, workflows: workflowList, today: todayIn(group.timezone), userId };
}

/** The list's settings page: its current settings for the form, for those who manage it. */
export async function getChallengeSettingsData(userId: string, challengeId: string) {
  const access = await getChallengeAccess(challengeId, userId);
  if (!access?.canManage) return null;
  const { challenge } = access;

  const [members, types, workflowList, participants, [{ total }]] = await Promise.all([
    db
      .select({ userId: groupMembers.userId, name: users.name, username: users.username })
      .from(groupMembers)
      .innerJoin(users, eq(users.id, groupMembers.userId))
      .where(eq(groupMembers.groupId, challenge.groupId))
      .orderBy(asc(groupMembers.joinedAt)),
    listMediaTypes(),
    listWorkflowsForGroup(challenge.groupId),
    activeParticipantIds(challengeId),
    db.select({ total: count() }).from(entries).where(eq(entries.challengeId, challengeId)),
  ]);
  const settings = currentSettings(challenge, participants);

  return {
    challenge: { id: challenge.id, title: challenge.title, groupId: challenge.groupId },
    visitingAsSiteAdmin: access.siteAdmin && !access.isMember,
    form: {
      groupId: challenge.groupId,
      today: todayIn(challenge.timezone),
      members,
      mediaTypes: types,
      workflows: workflowList,
      edit: { ...settings, challengeId: challenge.id, locked: total > 0 },
    },
  };
}

/** `round`: a round other than the current one (lists without planning); `as`: whom to add for (group admins). */
export type SuggestPageParams = { round?: string; mode?: string; media?: string; as?: string };

/** Where an addition goes and whose it is, as the add panel shows (and switches) them. */
export type AddContext = {
  /** Planning lists choose a round in the form; pool lists add to the pool unless a round is named. */
  kind: "plan" | "pool" | "rounds";
  /** The round it goes into (lists without planning); null for a pool, or when no round runs. */
  round: { index: number; label: string; timing: RoundTiming } | null;
  credited: { id: string; name: string; isViewer: boolean };
  /** For a round that is over: how "who finished it?" asks about each possible recipient. */
  audiences: { recipientId: string | null; audience: FinishedAudience }[];
  /** Rounds to switch to (lists without planning), each with its link. */
  rounds: { key: string; label: string; timing: RoundTiming | "pool"; href: string; selected: boolean }[];
  /** Group admins: the people to add for, each with its link. */
  people: { id: string; name: string; href: string; selected: boolean }[];
};

export async function getSuggestPageData(userId: string, challengeId: string, params: SuggestPageParams = {}) {
  const access = await getChallengeAccess(challengeId, userId);
  if (!access) return null;
  const { challenge } = access;

  await syncRounds([challenge]);
  const [{ strategy, config }, participants, allTypes] = await Promise.all([
    getSuggestionState(challenge, userId),
    listParticipants(challengeId),
    listMediaTypes(),
  ]);

  const names = new Map(participants.map((participant) => [participant.userId, participant.name]));
  const mediaTypeOptions = challenge.mediaTypes.length
    ? allTypes.filter((type) => challenge.mediaTypes.includes(type.slug))
    : allTypes;
  const allowedTypes = mediaTypeOptions.map((type) => type.slug);
  const active = participants.filter((participant) => participant.isActive);

  // Whose item it is: group admins may pick another participant.
  const creditedId = access.isAdmin && params.as && active.some((participant) => participant.userId === params.as) ? params.as : userId;
  const planningRules = strategy.planning?.(config) ?? null;
  const poolList = Boolean(strategy.poolRules?.(config));
  const may = canAddAs({
    actorId: userId,
    creditedId,
    actorIsParticipant: access.isParticipant,
    creditedIsParticipant: active.some((participant) => participant.userId === creditedId),
    isAdmin: access.isAdmin,
  });
  // Links that switch the panel's round or person and keep the rest (a planning list keeps its round and mode).
  const link = (round: number | null, as: string) => {
    const query = new URLSearchParams({ add: "1" });
    const keptRound = round !== null ? String(round) : planningRules ? (params.round ?? null) : null;
    if (keptRound !== null) query.set("round", keptRound);
    if (planningRules && params.mode) query.set("mode", params.mode);
    if (as !== userId) query.set("as", as);
    if (params.media) query.set("media", params.media);
    return `/challenges/${challenge.id}?${query}`;
  };

  // Where it goes: planning lists choose in the form; elsewhere the named round, else the current one
  // (a pool list's pool), else the first round ahead that takes something from this person.
  const blocked: SuggestionOptions | null =
    challenge.status !== "active"
      ? { allowed: false, reason: "Liste şu an aktif değil." }
      : !may.ok
        ? { allowed: false, reason: may.reason }
        : null;
  let target: RoundRef | null = null;
  let rounds: AddContext["rounds"] = [];
  let options: SuggestionOptions;
  if (planningRules) {
    options = blocked ?? (await getSuggestionState(challenge, creditedId)).options;
  } else {
    const [roundRows, filled] = await Promise.all([
      loadPlanRounds(challengeId),
      db
        .select({ roundId: entries.roundId, total: count() })
        .from(entries)
        .innerJoin(workflowStates, eq(workflowStates.id, entries.stateId))
        .where(and(eq(entries.challengeId, challengeId), ne(workflowStates.category, "dropped")))
        .groupBy(entries.roundId),
    ]);
    const filledByRound = new Map(filled.flatMap((row) => (row.roundId ? [[row.roundId, row.total] as const] : [])));
    const choices = selectableRounds(challenge, roundRows, filledByRound);
    const requested = /^\d+$/.test(params.round ?? "") ? Number(params.round) : null;
    let missing = false;
    if (requested !== null) {
      target = await findRound(db, challenge, requested);
      missing = target === null;
    } else if (!poolList) {
      target = await findCurrentRound(challenge);
      if (!blocked && !(await checkTarget(db, challenge, creditedId, target)).allowed) {
        for (const choice of choices.filter((choice) => choice.timing === "future")) {
          if ((await checkTarget(db, challenge, creditedId, choice)).allowed) {
            target = choice;
            break;
          }
        }
      }
    }
    options = blocked ?? (missing ? { allowed: false, reason: "Bu tur bulunamadı." } : await checkTarget(db, challenge, creditedId, target));

    const ordered = [
      ...choices.filter((choice) => choice.timing === "current"),
      ...choices.filter((choice) => choice.timing === "future"),
      ...choices.filter((choice) => choice.timing === "past").reverse(),
    ];
    rounds = [
      ...(poolList ? [{ key: "pool", label: "Havuz (tur seçimi kurallara göre)", timing: "pool" as const, href: link(null, creditedId), selected: target === null }] : []),
      ...ordered.map((choice) => ({
        key: String(choice.index),
        label: describeSlotOption({ label: choice.label, timing: choice.timing, isFull: false }),
        timing: choice.timing,
        href: link(choice.timing === "current" && !poolList ? null : choice.index, creditedId),
        selected: target?.index === choice.index,
      })),
    ];
  }

  const context: AddContext = {
    kind: planningRules ? "plan" : poolList ? "pool" : "rounds",
    round: target ? { index: target.index, label: target.label, timing: target.timing } : null,
    credited: { id: creditedId, name: names.get(creditedId) ?? "?", isViewer: creditedId === userId },
    audiences: (options.allowed ? options.targets : []).map((recipientId) => ({
      recipientId,
      audience:
        recipientId === null
          ? groupAudience(active.length)
          : recipientId === userId
            ? { kind: "me" }
            : { kind: "person", name: names.get(recipientId) ?? "?" },
    })),
    rounds,
    people: access.isAdmin
      ? [...active]
          .sort((a, b) => Number(b.userId === userId) - Number(a.userId === userId))
          .map((participant) => ({
            id: participant.userId,
            name: participant.userId === userId ? `${participant.name} (sen)` : participant.name,
            href: link(target && !(target.timing === "current" && !poolList) ? target.index : null, participant.userId),
            selected: participant.userId === creditedId,
          }))
      : [],
  };

  const planning = planningRules;
  let plan: {
    options: SlotOption[];
    defaultIndex: number | null;
    defaultMode: "plan" | "suggest";
    capacity: number | null;
    participantCount: number;
  } | null = null;
  if (options.allowed && options.placement === "plan" && planning) {
    const choices = await loadSlotOptions(challenge, planning);
    plan = {
      options: choices,
      defaultIndex: defaultSlot(choices, params.round)?.index ?? null,
      defaultMode: params.mode === "suggest" || choices.length === 0 ? "suggest" : "plan",
      capacity: planning.itemsPerRound,
      participantCount: participants.filter((participant) => participant.isActive).length,
    };
  }

  const [preselected, picks, existingRows] = await Promise.all([
    params.media && isUuid(params.media) ? findPick(params.media, allowedTypes) : Promise.resolve(null),
    options.allowed ? listMyPicks(userId, allowedTypes) : Promise.resolve([]),
    // What the list already holds (dropped items may come back), to mark search results.
    db
      .select({
        entryId: entries.id,
        id: mediaItems.id,
        source: mediaItems.source,
        externalId: mediaItems.externalId,
        ...titleColumns,
        mediaType: mediaItems.mediaType,
      })
      .from(entries)
      .innerJoin(mediaItems, eq(mediaItems.id, entries.mediaItemId))
      .innerJoin(workflowStates, eq(workflowStates.id, entries.stateId))
      .where(and(eq(entries.challengeId, challengeId), ne(workflowStates.category, "dropped"))),
  ]);

  return {
    challenge: { id: challenge.id, title: challenge.title, groupId: challenge.groupId, groupName: challenge.groupName },
    options,
    targets: options.allowed
      ? options.targets.map((id) => ({ id, name: id ? (names.get(id) ?? "?") : "Tüm grup" }))
      : [],
    mediaTypes: mediaTypeOptions,
    plan,
    context,
    preselected,
    picks,
    existing: describeExisting(existingRows.map((row) => ({ ...row, href: `/entries/${row.entryId}` }))),
  };
}

export type SuggestPageData = NonNullable<Awaited<ReturnType<typeof getSuggestPageData>>>;

/** A catalog item handed over from a personal list ("Ortak listeye öner"). */
async function findPick(mediaItemId: string, allowedTypes: string[]) {
  const [item] = await db
    .select({
      mediaItemId: mediaItems.id,
      mediaType: mediaItems.mediaType,
      ...titleColumns,
      year: mediaItems.year,
      creators: mediaItems.creators,
      imageUrl: mediaItems.imageUrl,
      icon: mediaTypes.icon,
    })
    .from(mediaItems)
    .innerJoin(mediaTypes, eq(mediaTypes.slug, mediaItems.mediaType))
    .where(and(eq(mediaItems.id, mediaItemId), inArray(mediaItems.mediaType, allowedTypes)))
    .limit(1);
  return item ? { ...item, listTitle: null } : null;
}
