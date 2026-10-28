import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getAuth } from "./auth";

export type CurrentUser = { id: string; name: string; username: string | null };

// Data Access Layer entry point: every page and Server Action resolves the user through
// here, so authorization never depends on the proxy or the UI. Reading headers() makes the
// caller request-time only, which is why pages call this inside a <Suspense> boundary.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;
  return { id: session.user.id, name: session.user.name, username: session.user.username ?? null };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}
