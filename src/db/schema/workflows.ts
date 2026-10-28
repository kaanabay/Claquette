import { index, integer, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt } from "./columns";
import { groups } from "./groups";

// States are data, categories are code. The engine (strategies, auto-complete, dashboards)
// only reasons about these four categories, so adding a state such as "Okunuyor" or
// "Ertelendi" to a workflow never requires a code change.
export const stateCategory = pgEnum("state_category", ["pending", "active", "done", "dropped"]);

export const workflows = pgTable("workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Stable key for system workflows (e.g. 'default'); null for group-defined ones.
  key: text("key").unique(),
  // null = global template available to every group.
  groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: createdAt(),
});

export const workflowStates = pgTable(
  "workflow_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    category: stateCategory("category").notNull(),
    // A palette token (slate, amber, sky, emerald, rose, violet), mapped to classes in the UI.
    color: text("color").notNull().default("slate"),
    position: integer("position").notNull(),
  },
  (t) => [
    uniqueIndex("workflow_states_key_idx").on(t.workflowId, t.key),
    index("workflow_states_position_idx").on(t.workflowId, t.position),
  ],
);
