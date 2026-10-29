import "server-only";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { AppError } from "@/lib/action-state";
import { requireUser } from "@/modules/auth/session";
import { isListedAdmin, parseSiteAdmins } from "./domain";

/** Whether the user runs the site (SITE_ADMINS); looked up once per request. */
export const isSiteAdmin = cache(async (userId: string): Promise<boolean> => {
  const admins = parseSiteAdmins(process.env.SITE_ADMINS);
  if (admins.size === 0) return false;
  const [user] = await db.select({ username: users.username }).from(users).where(eq(users.id, userId)).limit(1);
  return isListedAdmin(user?.username ?? null, admins);
});

/** Pages only for the site admin: anyone else gets a 404, as if the page didn't exist. */
export async function requireSiteAdmin() {
  const user = await requireUser();
  if (!(await isSiteAdmin(user.id))) notFound();
  return user;
}

export async function assertSiteAdmin(userId: string): Promise<void> {
  if (!(await isSiteAdmin(userId))) throw new AppError("Bunu yalnızca site yöneticisi yapabilir.");
}
