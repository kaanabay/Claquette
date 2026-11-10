"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { notificationReads, notificationState } from "@/db/schema";
import { requireUser } from "@/modules/auth/session";

/** One notification read (opened from the bell, or its "okundu" button). */
export async function markNotificationReadAction(activityId: string): Promise<void> {
  const user = await requireUser();
  if (!z.uuid().safeParse(activityId).success) return;
  await db.insert(notificationReads).values({ userId: user.id, activityId }).onConflictDoNothing();
}

/** "Tümünü okundu yap": everything so far counts as read; the one-by-one marks are no longer needed. */
export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser();
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .insert(notificationState)
      .values({ userId: user.id, readBefore: now })
      .onConflictDoUpdate({ target: notificationState.userId, set: { readBefore: now } });
    await tx.delete(notificationReads).where(eq(notificationReads.userId, user.id));
  });
}
