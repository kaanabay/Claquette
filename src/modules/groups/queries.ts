import "server-only";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { challenges, groupMembers, groups, users } from "@/db/schema";
import { isUuid } from "@/lib/utils";
import { listGroupActivity } from "@/modules/activity/service";
import { syncRounds } from "@/modules/challenges/rounds";
import { loadSharedListSummaries } from "@/modules/challenges/summaries";
import { getMembership, isAdminRole } from "./service";

// Counts are fetched with grouped queries and merged in code. (Correlated subqueries inside
// sql`` are fragile: in single-table selects Drizzle renders columns unqualified, so an outer
// reference like ${challenges.id} can silently bind to the inner table.)

async function countBy<K extends string>(rows: Promise<{ key: K; total: number }[]>) {
  return new Map((await rows).map((row) => [row.key, row.total]));
}

export async function listMyGroups(userId: string) {
  const memberships = await db
    .select({ id: groups.id, name: groups.name, description: groups.description, role: groupMembers.role })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.userId, userId))
    .orderBy(asc(groups.name));
  if (memberships.length === 0) return [];

  const ids = memberships.map((group) => group.id);
  const [members, active] = await Promise.all([
    countBy(
      db
        .select({ key: groupMembers.groupId, total: count() })
        .from(groupMembers)
        .where(inArray(groupMembers.groupId, ids))
        .groupBy(groupMembers.groupId),
    ),
    countBy(
      db
        .select({ key: challenges.groupId, total: count() })
        .from(challenges)
        .where(and(inArray(challenges.groupId, ids), eq(challenges.status, "active")))
        .groupBy(challenges.groupId),
    ),
  ]);

  return memberships.map((group) => ({
    ...group,
    memberCount: members.get(group.id) ?? 0,
    activeChallenges: active.get(group.id) ?? 0,
  }));
}

export async function getGroupPage(userId: string, groupId: string) {
  if (!isUuid(groupId)) return null;
  const membership = await getMembership(groupId, userId);
  if (!membership) return null;

  const [[group], members, challengeRows, activity] = await Promise.all([
    db.select().from(groups).where(eq(groups.id, groupId)),
    db
      .select({
        userId: groupMembers.userId,
        name: users.name,
        username: users.username,
        role: groupMembers.role,
        joinedAt: groupMembers.joinedAt,
      })
      .from(groupMembers)
      .innerJoin(users, eq(users.id, groupMembers.userId))
      .where(eq(groupMembers.groupId, groupId))
      .orderBy(asc(groupMembers.joinedAt)),
    db.select().from(challenges).where(eq(challenges.groupId, groupId)).orderBy(desc(challenges.createdAt)),
    listGroupActivity(groupId, 20),
  ]);
  if (!group) return null;

  const withGroup = challengeRows.map((challenge) => ({ ...challenge, timezone: group.timezone, groupName: group.name }));
  await syncRounds(withGroup);

  return {
    group,
    role: membership.role,
    isAdmin: isAdminRole(membership.role),
    members,
    challenges: await loadSharedListSummaries(userId, withGroup),
    activity,
  };
}

export type GroupPageData = NonNullable<Awaited<ReturnType<typeof getGroupPage>>>;

/** Lightweight lookup for sub-pages: the group's name if the user belongs to it. */
export async function getGroupSummary(userId: string, groupId: string) {
  if (!isUuid(groupId)) return null;
  const membership = await getMembership(groupId, userId);
  if (!membership) return null;
  const [group] = await db.select({ id: groups.id, name: groups.name }).from(groups).where(eq(groups.id, groupId)).limit(1);
  return group ?? null;
}

export async function getInvitePreview(userId: string, code: string) {
  const [group] = await db
    .select({ id: groups.id, name: groups.name, description: groups.description })
    .from(groups)
    .where(eq(groups.inviteCode, code.trim().toUpperCase()))
    .limit(1);
  if (!group) return null;

  const [memberCount, membership] = await Promise.all([
    db.$count(groupMembers, eq(groupMembers.groupId, group.id)),
    getMembership(group.id, userId),
  ]);
  return { ...group, memberCount, isMember: Boolean(membership) };
}
