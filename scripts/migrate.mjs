// Applies the SQL migrations in ./drizzle. Used locally (`npm run db:migrate`) and on Vercel
// (`npm run vercel-build`). Plain JS so it runs on any Node >= 20.9 without a TS loader.
import { existsSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

// Preview deployments usually share the production database, so they must not migrate it
// from an unmerged branch. Set MIGRATE_ON_PREVIEW=1 when previews get their own database
// (for example Neon's per-preview branches).
if (process.env.VERCEL && process.env.VERCEL_ENV !== "production" && process.env.MIGRATE_ON_PREVIEW !== "1") {
  console.log("[migrate] Vercel preview deployment: skipping migrations.");
  process.exit(0);
}

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  process.exit(1);
}

const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
try {
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  console.log("[migrate] Database is up to date.");
} catch (error) {
  console.error("[migrate] Migration failed:", error);
  process.exitCode = 1;
} finally {
  await client.end();
}
