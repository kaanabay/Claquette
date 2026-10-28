import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { challenges } from "./challenges";
import { createdAt, updatedAt } from "./columns";
import { groups } from "./groups";

// The board ("Pano"): notes everyone in a group can add and edit, on a shared list or on the group
// itself. What the friends keep in mind next to their lists: a pool of directors to pick from,
// links, ideas. Nothing reads them but people; the engine never does.
export const boardNotes = pgTable(
  "board_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    // null = the group's own board.
    challengeId: uuid("challenge_id").references(() => challenges.id, { onDelete: "cascade" }),
    title: text("title"),
    // Plain text; lines starting with "[ ]" or "[x]" form a checklist (see modules/boards/domain.ts).
    body: text("body").notNull().default(""),
    isPinned: boolean("is_pinned").notNull().default(false),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
    // Deleted notes stay a while, so "Geri al" can bring them back.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: text("deleted_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("board_notes_board_idx").on(t.groupId, t.challengeId)],
);
