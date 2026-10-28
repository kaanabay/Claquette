import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { db } from "@/db";
import { accounts, rateLimits, sessions, users, verifications } from "@/db/schema";

// On Vercel the app is reachable via the production domain and per-deployment/branch URLs.
const vercelOrigins = [
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
  process.env.VERCEL_BRANCH_URL,
  process.env.VERCEL_URL,
]
  .filter((host): host is string => Boolean(host))
  .map((host) => `https://${host}`);

function createAuth() {
  return betterAuth({
    appName: "Claquette",
    baseURL: process.env.BETTER_AUTH_URL || vercelOrigins[0] || "http://localhost:3000",
    trustedOrigins: vercelOrigins,
    database: drizzleAdapter(db, {
      provider: "pg",
      usePlural: true,
      schema: { users, sessions, accounts, verifications, rateLimits },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      autoSignIn: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days, refreshed while in use
      cookieCache: { enabled: true, maxAge: 5 * 60 }, // skip the DB on most requests
    },
    // Stored in Postgres so the limit holds across serverless instances (sign-in: 3 tries / 10 s per IP).
    rateLimit: { storage: "database" },
    // Sign-up goes through a Server Action that checks REGISTRATION_CODE first.
    disabledPaths: ["/sign-up/email"],
    plugins: [
      username({ displayUsername: false }),
      nextCookies(), // keep last: lets Server Actions set auth cookies
    ],
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

/** Created on first use, so builds don't need auth secrets. */
export function getAuth() {
  return (instance ??= createAuth());
}
