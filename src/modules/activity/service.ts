import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, type Executor } from "@/db";
import { activities, challenges, users } from "@/db/schema";

export type ActivityType =
  | "group.created"
  | "group.updated"
  | "member.joined"
  | "member.role_changed"
  | "member.removed"
  | "challenge.created"
  | "challenge.updated"
  | "challenge.joined"
  | "challenge.left"
  | "challenge.status_changed"
  | "round.started"
  | "entry.suggested"
  | "entry.state_changed"
  | "entry.selected"
  | "entry.planned"
  | "entry.moved"
  | "entry.unplanned"
  | "entry.deleted"
  | "progress.updated"
  | "note.added"
  | "board.note_added"
  | "workflow.created";

export async function logActivity(
  executor: Executor,
  input: {
    groupId: string;
    challengeId?: string | null;
    entryId?: string | null;
    actorId: string | null;
    type: ActivityType;
    data?: Record<string, unknown>;
  },
): Promise<void> {
  await executor.insert(activities).values({
    groupId: input.groupId,
    challengeId: input.challengeId ?? null,
    entryId: input.entryId ?? null,
    actorId: input.actorId,
    type: input.type,
    data: input.data ?? {},
  });
}

export type ActivityItem = {
  id: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: Date;
  actorId: string | null;
  actorName: string | null;
  challengeId: string | null;
  challengeTitle: string | null;
  entryId: string | null;
};

const actor = alias(users, "actor");

function selectActivities() {
  return db
    .select({
      id: activities.id,
      type: activities.type,
      data: activities.data,
      createdAt: activities.createdAt,
      actorId: activities.actorId,
      actorName: actor.name,
      challengeId: activities.challengeId,
      challengeTitle: challenges.title,
      entryId: activities.entryId,
    })
    .from(activities)
    .leftJoin(actor, eq(actor.id, activities.actorId))
    .leftJoin(challenges, eq(challenges.id, activities.challengeId));
}

export async function listGroupActivity(groupId: string, limit = 25): Promise<ActivityItem[]> {
  return selectActivities().where(eq(activities.groupId, groupId)).orderBy(desc(activities.createdAt)).limit(limit);
}

export async function listEntryActivity(groupId: string, entryId: string, limit = 50): Promise<ActivityItem[]> {
  return selectActivities()
    .where(and(eq(activities.groupId, groupId), eq(activities.entryId, entryId)))
    .orderBy(desc(activities.createdAt))
    .limit(limit);
}
