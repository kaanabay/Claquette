import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { searchMedia, searchPeople } from "@/modules/media/providers";
import { normalizeQuery } from "@/modules/media/providers/matching";

// Search proxy: keeps API keys on the server and lets Next.js cache provider responses.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });

  const type = request.nextUrl.searchParams.get("type") ?? "";
  // The same search in another case or spacing hits the same cached provider responses.
  const query = normalizeQuery(request.nextUrl.searchParams.get("q") ?? "");
  if (query.length < 2) return NextResponse.json({ results: [], failed: [], people: [] });

  const [found, people] = await Promise.all([searchMedia(type, query), searchPeople(type, query)]);
  return NextResponse.json({ ...found, people });
}
