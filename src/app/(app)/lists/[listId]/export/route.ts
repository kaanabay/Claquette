import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { getListExport } from "@/modules/exports/queries";
import { exportResponse } from "@/modules/exports/response";

// The proxy lets /lists/<id>/… through without a session (public lists); the query decides who may see it.
export async function GET(request: NextRequest, ctx: RouteContext<"/lists/[listId]/export">) {
  const { listId } = await ctx.params;
  const user = await getCurrentUser();
  return exportResponse(await getListExport(user?.id ?? null, listId), request.nextUrl.searchParams.get("format"));
}
