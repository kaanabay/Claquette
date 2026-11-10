import "server-only";
import { and, desc, eq, gte, inArray, isNull, lt, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { activities, challengeParticipants, challenges, entries, groupMembers, groups, notificationReads, notificationState, users } from "@/db/schema";
import { describeNotification, isNotifiable, notificationHref } from "./domain";

/** How many recent activities the unread count looks at; beyond it the badge says "9+" anyway. */
const WINDOW = 200;
const PAGE = 30;

export type NotificationItem = {
  id: string;
  actorId: string | null;
  /** First name of whoever did it; null when the app did it by itself. */
  actor: string | null;
  text: string;
  /** The list (or group) it happened in. */
  context: string;
  href: string;
  /** ISO time. */
  createdAt: string;
  unread: boolean;
};

const actorUser = alias(users, "actor");

/**
 * The viewer's notifications, newest first: what others did (or the app did) in the groups they
 * belong to, and in the lists they take part in, since they joined. `before` pages further back.
 */
export async function getNotifications(userId: string, options: { before?: Date | null } = {}) {
  const rows = await db
    .select({
      id: activities.id,
      type: activities.type,
      data: activities.data,
      createdAt: activities.createdAt,
      groupId: activities.groupId,
      groupName: groups.name,
      challengeId: activities.challengeId,
      challengeTitle: challenges.title,
      entryId: activities.entryId,
      actorId: activities.actorId,
      actorName: actorUser.name,
      suggestedFor: entries.suggestedFor,
    })
    .from(activities)
    .innerJoin(groupMembers, and(eq(groupMembers.groupId, activities.groupId), eq(groupMembers.userId, userId)))
    .innerJoin(groups, eq(groups.id, activities.groupId))
    .leftJoin(
      challengeParticipants,
      and(eq(challengeParticipants.challengeId, activities.challengeId), eq(challengeParticipants.userId, userId)),
    )
    .leftJoin(challenges, eq(challenges.id, activities.challengeId))
    .leftJoin(entries, eq(entries.id, activities.entryId))
    .leftJoin(actorUser, eq(actorUser.id, activities.actorId))
    .where(
      and(
        or(isNull(activities.actorId), ne(activities.actorId, userId)),
        gte(activities.createdAt, groupMembers.joinedAt),
        // A list's events reach the people taking part in it (from when they joined).
        or(
          isNull(activities.challengeId),
          and(eq(challengeParticipants.isActive, true), gte(activities.createdAt, challengeParticipants.joinedAt)),
        ),
        options.before ? lt(activities.createdAt, options.before) : undefined,
      ),
    )
    .orderBy(desc(activities.createdAt))
    .limit(WINDOW);

  const notifiable = rows.filter((row) => isNotifiable(row.type, row.data, userId));
  const [state, reads] = await Promise.all([
    db
      .select({ readBefore: notificationState.readBefore, joined: users.createdAt })
      .from(users)
      .leftJoin(notificationState, eq(notificationState.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1),
    notifiable.length
      ? db
          .select({ activityId: notificationReads.activityId })
          .from(notificationReads)
          .where(and(eq(notificationReads.userId, userId), inArray(notificationReads.activityId, notifiable.map((row) => row.id))))
      : Promise.resolve([]),
  ]);
  // Someone without a state yet has read nothing since they signed up.
  const readBefore = state[0]?.readBefore ?? state[0]?.joined ?? new Date(0);
  const read = new Set(reads.map((row) => row.activityId));
  const isUnread = (row: (typeof rows)[number]) => row.createdAt > readBefore && !read.has(row.id);

  const items: NotificationItem[] = notifiable.slice(0, PAGE).map((row) => {
    const { actor, text } = describeNotification({
      type: row.type,
      data: row.data,
      actorName: row.actorName,
      forViewer: row.suggestedFor === userId,
    });
    return {
      id: row.id,
      actorId: row.actorId,
      actor,
      text,
      context: row.challengeTitle ?? row.groupName,
      href: notificationHref(row),
      createdAt: row.createdAt.toISOString(),
      unread: isUnread(row),
    };
  });

  return {
    unread: notifiable.filter(isUnread).length,
    items,
    hasMore: notifiable.length > PAGE || rows.length === WINDOW,
  };
}

export type NotificationsPage = Awaited<ReturnType<typeof getNotifications>>;
