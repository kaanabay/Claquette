CREATE TYPE "public"."list_sort" AS ENUM('manual', 'newest', 'oldest', 'title', 'year');--> statement-breakpoint
ALTER TABLE "media_items" ADD COLUMN "season_number" integer;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "sort" "list_sort" DEFAULT 'manual' NOT NULL;