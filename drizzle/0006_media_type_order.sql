-- Films and series come first in every type picker: they are what the club adds most.
UPDATE "media_types" SET "sort_order" = 1 WHERE "slug" = 'movie';--> statement-breakpoint
UPDATE "media_types" SET "sort_order" = 2 WHERE "slug" = 'tv';--> statement-breakpoint
UPDATE "media_types" SET "sort_order" = 3 WHERE "slug" = 'book';
