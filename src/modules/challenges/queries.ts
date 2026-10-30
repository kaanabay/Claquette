import "server-only";
import { and, asc, count, eq, inArray, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { entries, groupMembers, groups, mediaItems, mediaTypes, roundAssignments, users, workflowStates } from "@/db/schema";
import { isUuid } from "@/lib/utils";
import { groupAudience, type FinishedAudience } from "@/modules/entries/labels";
import { loadEntryCards, type EntryCard } from "@/modules/entries/queries";
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
import { canRecordPick, parseSlotKey, type PickTiming } from "./domain/history";
import { canAcceptSuggestion } from "./domain/plan";
import { findPickSlot, loadHistory } from "./history";
import { buildSlots, loadPlanRounds, loadSlotOptions, toSlotOptions, type SlotOption } from "./planning";
import { syncRounds } from "./rounds";
import { activeParticipantIds, currentSettings } from "./settings";
import { getSuggestionState } from "./suggestions";

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
  const historyRules = strategy.history?.(config) ?? null;
  const history = historyRules
    ? {
        picksPerAssignment: historyRules.picksPerAssignment,
        rounds: await loadHistory(challenge, historyRules, roundRows, cards, participants.map((participant) => participant.userId)),
      }
    : null;

  return {
    viewerId: userId,
    access,
    challenge,
    strategy: { key: strategy.key, label: strategy.label, summary: strategy.summary, description: strategy.describeConfig(config) },
    suggestion: suggestion.options,
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
    history,
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

/** `round` + `slot` (whose pick, for whom) enter a pick afterwards, on lists with history. */
export type SuggestPageParams = { round?: string; mode?: string; media?: string; slot?: string };

/** A pick entered from the add panel (a round that is over, or on someone's behalf): the assignment, or why not. */
export type PickTarget =
  | {
      ok: true;
      timing: PickTiming;
      roundIndex: number;
      roundLabel: string;
      slot: string;
      pickerName: string;
      pickerIsViewer: boolean;
      recipientName: string;
      /** Picks the assignment still takes. */
      open: number;
      audience: FinishedAudience;
    }
  | { ok: false; reason: string };

export async function getSuggestPageData(userId: string, challengeId: string, params: SuggestPageParams = {}) {
  const access = await getChallengeAccess(challengeId, userId);
  if (!access) return null;
  const { challenge } = access;

  await syncRounds([challenge]);
  const [{ options, round, strategy, config }, participants, allTypes] = await Promise.all([
    getSuggestionState(challenge, userId),
    listParticipants(challengeId),
    listMediaTypes(),
  ]);

  const names = new Map(participants.map((participant) => [participant.userId, participant.name]));
  const mediaTypeOptions = challenge.mediaTypes.length
    ? allTypes.filter((type) => challenge.mediaTypes.includes(type.slug))
    : allTypes;
  const allowedTypes = mediaTypeOptions.map((type) => type.slug);

  const historyRules = strategy.history?.(config) ?? null;
  const pickSlot = historyRules && params.slot && /^\d+$/.test(params.round ?? "") ? parseSlotKey(params.slot) : null;
  let pick: PickTarget | null = null;
  if (historyRules && pickSlot) {
    const lookup =
      challenge.status !== "active"
        ? { ok: false as const, reason: "Liste şu an aktif değil." }
        : await findPickSlot(db, challenge, historyRules, Number(params.round), pickSlot);
    const allowed = lookup.ok
      ? canRecordPick({
          actorId: userId,
          pickerId: pickSlot.pickerId,
          timing: lookup.slot.timing,
          isParticipant: access.isParticipant,
          isAdmin: access.isAdmin,
        })
      : lookup;
    const found = allowed.ok ? lookup : allowed;
    const activeCount = participants.filter((participant) => participant.isActive).length;
    pick = found.ok
      ? {
          ok: true,
          timing: found.slot.timing,
          roundIndex: found.slot.round.index,
          roundLabel: found.slot.label,
          slot: params.slot!,
          pickerName: found.slot.pickerName,
          pickerIsViewer: pickSlot.pickerId === userId,
          recipientName: found.slot.recipientName ?? "Tüm grup",
          open: found.slot.open,
          audience:
            pickSlot.recipientId === null
              ? groupAudience(activeCount)
              : pickSlot.recipientId === userId
                ? { kind: "me" }
                : { kind: "person", name: found.slot.recipientName ?? "?" },
        }
      : found;
  }

  const planning = strategy.planning?.(config) ?? null;
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
    options.allowed || pick?.ok ? listMyPicks(userId, allowedTypes) : Promise.resolve([]),
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
    roundIndex: round?.index ?? null,
    mediaTypes: mediaTypeOptions,
    plan,
    pick,
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
