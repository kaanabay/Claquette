import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

/** What the account page shows besides the session's name and username. */
export async function getProfile(userId: string) {
  const [profile] = await db.select({ email: users.email, joinedAt: users.createdAt }).from(users).where(eq(users.id, userId)).limit(1);
  return profile ?? null;
}
