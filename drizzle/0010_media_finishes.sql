-- "İzledim" on personal lists: what a person finished outside the shared lists, and what each list remembers about it. Only adds a table and a column; nothing existing changes.
CREATE TABLE "media_finishes" (
	"user_id" text NOT NULL,
	"media_item_id" uuid NOT NULL,
	"list_id" uuid,
	"finished_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_finishes_user_id_media_item_id_pk" PRIMARY KEY("user_id","media_item_id")
);
--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "remove_when_finished" boolean;--> statement-breakpoint
ALTER TABLE "media_finishes" ADD CONSTRAINT "media_finishes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_finishes" ADD CONSTRAINT "media_finishes_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_finishes" ADD CONSTRAINT "media_finishes_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_finishes_list_idx" ON "media_finishes" USING btree ("list_id");
