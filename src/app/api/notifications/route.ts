import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { getNotifications } from "@/modules/notifications/queries";

// The bell asks here on load, every minute while the tab is in view, and when it opens: the count
// stays fresh without the page's shell (which stays prerendered) waiting for it.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const raw = request.nextUrl.searchParams.get("before");
  const before = raw ? new Date(raw) : null;
  const page = await getNotifications(user.id, { before: before && !Number.isNaN(before.getTime()) ? before : null });
  return NextResponse.json(page, { headers: { "Cache-Control": "no-store" } });
}
