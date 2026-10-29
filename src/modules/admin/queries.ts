import "server-only";
import { asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { challenges, groupMembers, groups, users } from "@/db/schema";

// The site admin's overview. Counts come from grouped queries merged in code.

export async function getAdminOverview(viewerId: string) {
  const [groupRows, userRows, memberCounts, listCounts, memberships] = await Promise.all([
    db.select({ id: groups.id, name: groups.name, createdAt: groups.createdAt }).from(groups).orderBy(asc(groups.name)),
    db
      .select({ id: users.id, name: users.name, username: users.username, email: users.email, createdAt: users.createdAt })
      .from(users)
      .orderBy(asc(users.name)),
    db.select({ groupId: groupMembers.groupId, total: count() }).from(groupMembers).groupBy(groupMembers.groupId),
    db.select({ groupId: challenges.groupId, total: count() }).from(challenges).where(eq(challenges.status, "active")).groupBy(challenges.groupId),
    db.select({ userId: groupMembers.userId, groupId: groupMembers.groupId }).from(groupMembers),
  ]);
  const members = new Map(memberCounts.map((row) => [row.groupId, row.total]));
  const lists = new Map(listCounts.map((row) => [row.groupId, row.total]));
  const groupsOf = (userId: string) => memberships.filter((row) => row.userId === userId).length;

  return {
    groups: groupRows.map((group) => ({
      ...group,
      memberCount: members.get(group.id) ?? 0,
      activeLists: lists.get(group.id) ?? 0,
      isMember: memberships.some((row) => row.groupId === group.id && row.userId === viewerId),
    })),
    users: userRows.map((user) => ({ ...user, groupCount: groupsOf(user.id), isViewer: user.id === viewerId })),
  };
}

export type AdminOverview = Awaited<ReturnType<typeof getAdminOverview>>;
