import "server-only";
import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { AppError } from "@/lib/action-state";
import { getAuth } from "@/modules/auth/auth";
import { assertSiteAdmin } from "./access";
import { temporaryPassword } from "./domain";

/**
 * There is no e-mail in the app, so a forgotten password is reset by the site admin: the account
 * gets a temporary password (shown once, to pass on) and every session it had is signed out.
 * Passwords are stored hashed; nobody can read the old one.
 */
export async function resetPassword(adminId: string, userId: string): Promise<{ name: string; password: string }> {
  await assertSiteAdmin(adminId);
  const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new AppError("Kullanıcı bulunamadı.");

  const context = await getAuth().$context;
  if (!(await context.internalAdapter.findCredentialAccount(userId))) throw new AppError("Bu hesabın şifresi yok.");
  const password = temporaryPassword(randomInt);
  await context.internalAdapter.updatePassword(userId, await context.password.hash(password));
  await context.internalAdapter.deleteUserSessions(userId);
  return { name: user.name, password };
}
