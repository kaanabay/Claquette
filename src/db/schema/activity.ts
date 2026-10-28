import { index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { challenges } from "./challenges";
import { createdAt } from "./columns";
import { entries } from "./entries";
import { groups } from "./groups";

// Append-only event log: powers the group feed and each entry's history.
// `data` holds a snapshot (titles, state labels) so old events still read correctly
// after things are renamed.
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    challengeId: uuid("challenge_id").references(() => challenges.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id").references(() => entries.id, { onDelete: "cascade" }),
    // null = done by the system (e.g. automatic completion or pool draw).
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    index("activities_group_created_idx").on(t.groupId, t.createdAt),
    index("activities_entry_idx").on(t.entryId),
  ],
);
