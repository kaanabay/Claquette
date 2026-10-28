import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { createdAt, updatedAt } from "./columns";

/** Type-specific details that don't deserve their own column. */
export type MediaMetadata = {
  pageCount?: number;
  runtimeMinutes?: number;
  seasons?: number;
  episodes?: number;
  genres?: string[];
  isbn?: string;
  publisher?: string;
  language?: string;
  [key: string]: unknown;
};

// A lookup table instead of an enum: a new media type is one INSERT and immediately works
// with manual entry. Automatic metadata needs a provider adapter in src/modules/media/providers.
export const mediaTypes = pgTable("media_types", {
  slug: text("slug").primaryKey(),
  label: text("label").notNull(),
  icon: text("icon").notNull().default("✨"),
  creatorLabel: text("creator_label").notNull().default("Yaratıcı"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

// Shared catalog. Items imported from an API are deduplicated by (source, external_id);
// manual items have source = 'manual' and no external id.
export const mediaItems = pgTable(
  "media_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mediaType: text("media_type")
      .notNull()
      .references(() => mediaTypes.slug, { onUpdate: "cascade" }),
    title: text("title").notNull(),
    originalTitle: text("original_title"),
    // A Latin-script stand-in when the original uses another script: TMDB's English title,
    // "Stalker" for "Сталкер". The app leads with it (see modules/media/titles.ts).
    internationalTitle: text("international_title"),
    // A season of a series ("Lost · 2. Sezon") is its own catalog item; null for everything else.
    seasonNumber: integer("season_number"),
    year: integer("year"),
    creators: text("creators")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    description: text("description"),
    imageUrl: text("image_url"),
    source: text("source").notNull().default("manual"),
    externalId: text("external_id"),
    externalUrl: text("external_url"),
    metadata: jsonb("metadata").$type<MediaMetadata>().notNull().default({}),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("media_items_source_external_idx")
      .on(t.source, t.externalId)
      .where(sql`${t.externalId} is not null`),
    index("media_items_type_idx").on(t.mediaType),
  ],
);
