-- Personal lists can go into their owner's archive (folded at the bottom of "Listelerim"). Only adds a column; existing lists stay as they are.
ALTER TABLE "lists" ADD COLUMN "archived_at" timestamp with time zone;
