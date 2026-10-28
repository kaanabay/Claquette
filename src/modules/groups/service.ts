import "server-only";
import { and, eq } from "drizzle-orm";
import { db, type Executor } from "@/db";
import { groupMembers, groups } from "@/db/schema";
import { AppError } from "@/lib/action-state";
import { logActivity } from "@/modules/activity/service";

export type GroupRole = (typeof groupMembers.$inferSelect)["role"];

// 32 symbols without look-alikes (0/O, 1/I): easy to read out loud, and 256 % 32 == 0 so
// the byte → symbol mapping has no modulo bias.
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateInviteCode(length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => INVITE_ALPHABET[byte % INVITE_ALPHABET.length]).join("");
}

export const isAdminRole = (role: GroupRole) => role === "owner" || role === "admin";

export async function getMembership(groupId: string, userId: string, executor: Executor = db) {
  const [row] = await executor
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function requireMembership(groupId: string, userId: string, executor: Executor = db) {
  const membership = await getMembership(groupId, userId, executor);
  if (!membership) throw new AppError("Bu gruba erişimin yok.");
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
  const membership = await requireMembership(groupId, userId);
  if (!isAdminRole(membership.role)) throw new AppError("Davet kodunu yalnızca grup yöneticileri yenileyebilir.");
  await db.update(groups).set({ inviteCode: generateInviteCode() }).where(eq(groups.id, groupId));
}
