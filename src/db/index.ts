import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL tanımlı değil. .env.example dosyasını .env.local olarak kopyalayıp doldurun.");
  }
  // prepare: false keeps us compatible with transaction-mode poolers (Neon, Supabase).
  const client = postgres(url, { prepare: false, max: 5, idle_timeout: 20, onnotice: () => {} });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type Executor = Database | Transaction;

// One pool per server instance, reused across hot reloads in development.
const globalForDb = globalThis as typeof globalThis & { __claquetteDb?: Database };

function getDb(): Database {
  return (globalForDb.__claquetteDb ??= createDb());
}

// Connect lazily so that importing a module (e.g. during `next build`) never requires
// database credentials; the first query does.
export const db = new Proxy({} as Database, {
  get(_target, property) {
    const instance = getDb();
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
