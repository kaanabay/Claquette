import "server-only";
import { and, asc, eq, getTableColumns } from "drizzle-orm";
import { db, type Executor } from "@/db";
import { challengeParticipants, challenges, groups, users } from "@/db/schema";
import { AppError } from "@/lib/action-state";
import { isUuid } from "@/lib/utils";
import { getMembership, isAdminRole, type GroupRole } from "@/modules/groups/service";

export type ChallengeRecord = typeof challenges.$inferSelect & { timezone: string; groupName: string };

export async function loadChallenge(challengeId: string, executor: Executor = db): Promise<ChallengeRecord | null> {
  if (!isUuid(challengeId)) return null;
  const [row] = await executor
    .select({ ...getTableColumns(challenges), timezone: groups.timezone, groupName: groups.name })
    .from(challenges)
    .innerJoin(groups, eq(groups.id, challenges.groupId))
    .where(eq(challenges.id, challengeId))
    .limit(1);
  return row ?? null;
}

export type ParticipantRow = { userId: string; position: number; isActive: boolean; name: string; username: string | null };

export async function listParticipants(challengeId: string, executor: Executor = db): Promise<ParticipantRow[]> {
  return executor
    .select({
      userId: challengeParticipants.userId,
      position: challengeParticipants.position,
      isActive: challengeParticipants.isActive,
      name: users.name,
      username: users.username,
    })
    .from(challengeParticipants)
    .innerJoin(users, eq(users.id, challengeParticipants.userId))
    .where(eq(challengeParticipants.challengeId, challengeId))
    .orderBy(asc(challengeParticipants.position));
}

export type ChallengeAccess = {
  challenge: ChallengeRecord;
  role: GroupRole;
  isAdmin: boolean;
  isParticipant: boolean;
  /** Creator or group admin: may pause/archive the challenge. */
  canManage: boolean;
};

/** Loads a challenge and checks that the user belongs to its group. */
export async function getChallengeAccess(challengeId: string, userId: string): Promise<ChallengeAccess | null> {
  const challenge = await loadChallenge(challengeId);
  if (!challenge) return null;
  const membership = await getMembership(challenge.groupId, userId);
  if (!membership) return null;
  const [participant] = await db
    .select({ isActive: challengeParticipants.isActive })
    .from(challengeParticipants)
    .where(and(eq(challengeParticipants.challengeId, challengeId), eq(challengeParticipants.userId, userId)))
    .limit(1);
  const isAdmin = isAdminRole(membership.role);
  return {
    challenge,
    role: membership.role,
    isAdmin,
    isParticipant: Boolean(participant?.isActive),
    canManage: isAdmin || challenge.createdBy === userId,
  };
}

export async function requireChallengeAccess(challengeId: string, userId: string): Promise<ChallengeAccess> {
  const access = await getChallengeAccess(challengeId, userId);
  if (!access) throw new AppError("Liste bulunamadı.");
  return access;
}
