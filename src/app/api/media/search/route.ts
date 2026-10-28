import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { searchMedia } from "@/modules/media/providers";

// Search proxy: keeps API keys on the server and lets Next.js cache provider responses.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });

  const type = request.nextUrl.searchParams.get("type") ?? "";
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (query.length < 2) return NextResponse.json({ results: [], failed: [] });

  return NextResponse.json(await searchMedia(type, query));
}
