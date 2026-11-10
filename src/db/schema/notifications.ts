import { pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { activities } from "./activity";
import { users } from "./auth";

// Notifications are the activity log seen from one person: what others did in the groups and lists
// they take part in (see src/modules/notifications). Nothing is copied per person; only what they
// have read is stored.

/** Everything that happened before `read_before` counts as read ("Tümünü okundu yap"). */
export const notificationState = pgTable("notification_state", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  readBefore: timestamp("read_before", { withTimezone: true }).notNull().defaultNow(),
});

/** Notifications read one by one, after `read_before`. */
export const notificationReads = pgTable(
  "notification_reads",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.activityId] })],
);
