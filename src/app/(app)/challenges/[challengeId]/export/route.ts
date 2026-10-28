import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { getChallengeExport } from "@/modules/exports/queries";
import { exportResponse } from "@/modules/exports/response";

export async function GET(request: NextRequest, ctx: RouteContext<"/challenges/[challengeId]/export">) {
  const { challengeId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Oturum gerekli.", { status: 401 });
  return exportResponse(await getChallengeExport(user.id, challengeId), request.nextUrl.searchParams.get("format"));
}
