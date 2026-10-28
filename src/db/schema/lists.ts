import { boolean, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { createdAt, updatedAt } from "./columns";
import { mediaItems } from "./media";

// Personal lists ("Listelerim"): a watchlist, a year-end top 10… No rounds, rules or statuses;
// just an ordered collection that its owner can keep private or share by link.
export const listVisibility = pgEnum("list_visibility", ["private", "public"]);
// How the list is shown by default: its manual order, by date (a "watched" diary), title or year.
export const listSort = pgEnum("list_sort", ["manual", "newest", "oldest", "title", "year"]);

export const lists = pgTable(
  "lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    // private = only the owner; public = anyone with the link, no login needed.
    visibility: listVisibility("visibility").notNull().default("private"),
    // Ranked lists show their order as numbers (Top 10); every list keeps a manual order.
    isRanked: boolean("is_ranked").notNull().default(false),
    sort: listSort("sort").notNull().default("manual"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("lists_owner_idx").on(t.ownerId)],
);

export const listItems = pgTable(
  "list_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listId: uuid("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    mediaItemId: uuid("media_item_id")
      .notNull()
      .references(() => mediaItems.id, { onDelete: "restrict" }),
    // 0-based manual order; rewritten as a whole when the owner reorders.
    position: integer("position").notNull(),
    note: text("note"),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("list_items_list_media_idx").on(t.listId, t.mediaItemId),
    index("list_items_list_position_idx").on(t.listId, t.position),
  ],
);
