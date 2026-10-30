import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, type Executor } from "@/db";
import { challengeParticipants, challenges, groupMembers, groups, users } from "@/db/schema";
import { AppError } from "@/lib/action-state";
import { logActivity } from "@/modules/activity/service";
import { isSiteAdmin } from "@/modules/admin/access";
import { replanUpcomingRounds } from "@/modules/challenges/rounds";
import { settleEntries } from "@/modules/entries/settle";
import { canManageMember } from "./domain";

export type GroupRole = (typeof groupMembers.$inferSelect)["role"];

// 32 symbols without look-alikes (0/O, 1/I): easy to read out loud, and 256 % 32 == 0 so
// the byte → symbol mapping has no modulo bias.
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateInviteCode(length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => INVITE_ALPHABET[byte % INVITE_ALPHABET.length]).join("");
}

export const isAdminRole = (role: GroupRole) => role === "owner" || role === "admin";

/** The user's own membership row, or null. Use this for "is a member" questions. */
export async function findMembership(groupId: string, userId: string, executor: Executor = db) {
  const [row] = await executor
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  return row ?? null;
}

export type Membership = {
  role: GroupRole;
  /** The site admin (SITE_ADMINS) looks after every group with the owner's rights. */
  siteAdmin: boolean;
  isMember: boolean;
};

/** The user's rights in the group: their membership, or the owner's for the site admin. */
export async function getMembership(groupId: string, userId: string, executor: Executor = db): Promise<Membership | null> {
  const [membership, siteAdmin] = await Promise.all([findMembership(groupId, userId, executor), isSiteAdmin(userId)]);
  if (siteAdmin) return { role: "owner", siteAdmin: true, isMember: membership !== null };
  return membership ? { role: membership.role, siteAdmin: false, isMember: true } : null;
}

export async function requireMembership(groupId: string, userId: string, executor: Executor = db) {
  const membership = await getMembership(groupId, userId, executor);
  if (!membership) throw new AppError("Bu gruba erişimin yok.");
  return membership;
}

async function requireGroupAdmin(groupId: string, userId: string, message: string) {
  const membership = await requireMembership(groupId, userId);
  if (!isAdminRole(membership.role)) throw new AppError(message);
  return membership;
}

export async function createGroup(userId: string, input: { name: string; description: string | null }) {
  return db.transaction(async (tx) => {
    const [group] = await tx
      .insert(groups)
      .values({ name: input.name, description: input.description, inviteCode: generateInviteCode(), createdBy: userId })
      .returning({ id: groups.id });
    await tx.insert(groupMembers).values({ groupId: group.id, userId, role: "owner" });
    await logActivity(tx, { groupId: group.id, actorId: userId, type: "group.created", data: { name: input.name } });
    return group.id;
  });
}

export async function joinGroupByCode(userId: string, code: string): Promise<string> {
  const [group] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.inviteCode, code.trim().toUpperCase()))
    .limit(1);
  if (!group) throw new AppError("Bu davet koduyla bir grup bulunamadı.");

  const joined = await db
    .insert(groupMembers)
    .values({ groupId: group.id, userId, role: "member" })
    .onConflictDoNothing()
    .returning({ userId: groupMembers.userId });
  if (joined.length > 0) {
    await logActivity(db, { groupId: group.id, actorId: userId, type: "member.joined" });
  }
  return group.id;
}

export async function regenerateInviteCode(userId: string, groupId: string): Promise<void> {
  await requireGroupAdmin(groupId, userId, "Davet kodunu yalnızca grup yöneticileri yenileyebilir.");
  await db.update(groups).set({ inviteCode: generateInviteCode() }).where(eq(groups.id, groupId));
}

export async function updateGroup(userId: string, groupId: string, input: { name: string; description: string | null }): Promise<void> {
  await requireGroupAdmin(groupId, userId, "Grup bilgilerini yalnızca grup yöneticileri değiştirebilir.");
  const [group] = await db.select({ name: groups.name, description: groups.description }).from(groups).where(eq(groups.id, groupId));
  if (!group) throw new AppError("Grup bulunamadı.");
  if (group.name === input.name && group.description === input.description) return;
  await db.transaction(async (tx) => {
    await tx.update(groups).set({ name: input.name, description: input.description }).where(eq(groups.id, groupId));
    await logActivity(tx, {
      groupId,
      actorId: userId,
      type: "group.updated",
      data: { name: input.name, renamedFrom: group.name !== input.name ? group.name : null },
    });
  });
}

/** Loads a member and checks that the user may manage them (see canManageMember). */
async function requireManageableMember(userId: string, groupId: string, memberId: string, message: string) {
  const membership = await requireMembership(groupId, userId);
  const [member] = await db
    .select({ role: groupMembers.role, name: users.name })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, memberId)))
    .limit(1);
  if (!member) throw new AppError("Üye bulunamadı.");
  if (!canManageMember({ actorId: userId, actorIsAdmin: isAdminRole(membership.role), targetId: memberId, targetRole: member.role })) {
    throw new AppError(message);
  }
  return member;
}

export async function setMemberRole(userId: string, groupId: string, memberId: string, role: "admin" | "member"): Promise<void> {
  const member = await requireManageableMember(userId, groupId, memberId, "Bu üyenin rolünü değiştiremezsin.");
  if (member.role === role) return;
  await db.transaction(async (tx) => {
    await tx
      .update(groupMembers)
      .set({ role })
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, memberId)));
    await logActivity(tx, { groupId, actorId: userId, type: "member.role_changed", data: { name: member.name, role } });
  });
}

/**
 * Takes someone out of the group: they leave its lists, while what they added, wrote and marked
 * stays. Items everyone else has finished become done. They can come back with the invite code.
 */
export async function removeMember(userId: string, groupId: string, memberId: string): Promise<void> {
  const member = await requireManageableMember(userId, groupId, memberId, "Bu üyeyi gruptan çıkaramazsın.");
  const lists = await db.select({ id: challenges.id }).from(challenges).where(eq(challenges.groupId, groupId));
  const listIds = lists.map((list) => list.id);
  await db.transaction(async (tx) => {
    await tx.delete(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, memberId)));
    if (listIds.length > 0) {
      await tx
        .update(challengeParticipants)
        .set({ isActive: false })
        .where(and(inArray(challengeParticipants.challengeId, listIds), eq(challengeParticipants.userId, memberId)));
    }
    await logActivity(tx, { groupId, actorId: userId, type: "member.removed", data: { name: member.name } });
  });
  for (const listId of listIds) {
    await settleEntries(listId);
    await replanUpcomingRounds(listId);
  }
}
