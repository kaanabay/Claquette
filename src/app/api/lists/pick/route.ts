import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { pickCandidates } from "@/modules/lists/queries";

// "Bana bir şey seç" on "Listelerim": a few random items of the owner's lists outside the archive, none
// of them finished, of the type the page shows (`?type=`); the dialog draws from them.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const type = request.nextUrl.searchParams.get("type");
  const result = await pickCandidates(user.id, type && /^[a-z0-9_-]{1,40}$/.test(type) ? type : null);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
