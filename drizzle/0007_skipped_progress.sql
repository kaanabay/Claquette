-- "İzlemeyeceğim": a decision not to start an item at all. Only adds a value; existing rows stay as they are.
ALTER TYPE "public"."progress_status" ADD VALUE 'skipped';
