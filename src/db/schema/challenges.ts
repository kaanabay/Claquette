import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { createdAt, updatedAt } from "./columns";
import { groups } from "./groups";
import { workflows } from "./workflows";

// Cadence = unit × interval: weekly (week,1), quarterly (month,3), yearly (year,1),
// indefinite (none). Periods are anchored on `starts_on`.
export const cadenceUnit = pgEnum("cadence_unit", ["day", "week", "month", "year", "none"]);
export const challengeStatus = pgEnum("challenge_status", ["active", "paused", "archived"]);

// A "list / challenge": a container whose behaviour is fully described by data —
// cadence, a pluggable suggestion strategy (+ its JSON config) and a status workflow.
export const challenges = pgTable(
  "challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    // Allowed media type slugs; empty = any type.
    mediaTypes: text("media_types")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    cadenceUnit: cadenceUnit("cadence_unit").notNull(),
    cadenceInterval: integer("cadence_interval").notNull().default(1),
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    endsOn: date("ends_on", { mode: "string" }),
    // Key in the strategy registry (src/modules/challenges/domain/strategies).
    strategy: text("strategy").notNull(),
    // Validated by the strategy's own Zod schema; no migration needed for new options.
    strategyConfig: jsonb("strategy_config").$type<Record<string, unknown>>().notNull().default({}),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "restrict" }),
    status: challengeStatus("status").notNull().default("active"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("challenges_group_idx").on(t.groupId),
    check("challenges_cadence_interval_positive", sql`${t.cadenceInterval} > 0`),
  ],
);

// Who takes part, and in which order (rotation order = position).
export const challengeParticipants = pgTable(
  "challenge_participants",
  {
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.challengeId, t.userId] }), index("challenge_participants_user_idx").on(t.userId)],
);

// Materialized periods ("Tur 5: 13–19 Ekim"). Created lazily when someone opens the app,
// so no cron job is needed. For indefinite challenges a round is a manually advanced turn.
export const rounds = pgTable(
  "rounds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    index: integer("index").notNull(),
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    // Inclusive; null for an open-ended turn.
    endsOn: date("ends_on", { mode: "string" }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("rounds_challenge_index_idx").on(t.challengeId, t.index)],
);

// Output of a strategy's planRound(): who has to suggest to whom in a round. Stored, so past
// rounds stay correct when participants change later.
export const roundAssignments = pgTable(
  "round_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roundId: uuid("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    pickerId: text("picker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // null = the pick is for the whole group.
    recipientId: text("recipient_id").references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [index("round_assignments_round_idx").on(t.roundId), index("round_assignments_picker_idx").on(t.pickerId)],
);
