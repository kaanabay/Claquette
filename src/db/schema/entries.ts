import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { challenges, rounds } from "./challenges";
import { createdAt, updatedAt } from "./columns";
import { mediaItems } from "./media";
import { workflowStates } from "./workflows";

// Individual consumption, independent of the group-level workflow state.
export const progressStatus = pgEnum("progress_status", ["planned", "in_progress", "completed", "dropped"]);
export const noteVisibility = pgEnum("note_visibility", ["private", "shared"]);

// A media item placed into a challenge: the unit that moves through the workflow.
export const entries = pgTable(
  "entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    // null = waiting in the shared pool (pool strategy) until it is selected for a round.
    roundId: uuid("round_id").references(() => rounds.id, { onDelete: "set null" }),
    mediaItemId: uuid("media_item_id")
      .notNull()
      .references(() => mediaItems.id, { onDelete: "restrict" }),
    stateId: uuid("state_id")
      .notNull()
      .references(() => workflowStates.id, { onDelete: "restrict" }),
    suggestedBy: text("suggested_by").references(() => users.id, { onDelete: "set null" }),
    // null = suggested to the whole group.
    suggestedFor: text("suggested_for").references(() => users.id, { onDelete: "set null" }),
    // "Why I recommend this" — shown on the card.
    pitch: text("pitch"),
    stateChangedAt: timestamp("state_changed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("entries_challenge_idx").on(t.challengeId),
    index("entries_round_idx").on(t.roundId),
    index("entries_suggested_for_idx").on(t.suggestedFor),
  ],
);

// One row per (entry, user): personal progress and a 1–10 rating (5 stars with halves in the UI).
export const entryProgress = pgTable(
  "entry_progress",
  {
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: progressStatus("status").notNull().default("planned"),
    rating: smallint("rating"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.entryId, t.userId] }),
    check("entry_progress_rating_range", sql`${t.rating} is null or ${t.rating} between 1 and 10`),
  ],
);

// Personal (private) and shared notes; shared ones double as the discussion thread.
export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    visibility: noteVisibility("visibility").notNull().default("shared"),
    body: text("body").notNull(),
    isSpoiler: boolean("is_spoiler").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("notes_entry_idx").on(t.entryId, t.createdAt)],
);

// Votes on pool candidates (pool strategy, "votes" selection).
export const entryVotes = pgTable(
  "entry_votes",
  {
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.entryId, t.userId] })],
);
