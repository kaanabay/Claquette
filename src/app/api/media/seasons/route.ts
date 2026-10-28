import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { getProvider } from "@/modules/media/providers";

// The seasons of a series search result, so each can be added on its own ("Lost · 2. Sezon").
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });

  const provider = getProvider(request.nextUrl.searchParams.get("provider") ?? "");
  const externalId = (request.nextUrl.searchParams.get("id") ?? "").slice(0, 64);
  if (!provider?.getSeasons || !provider.isConfigured()) return NextResponse.json({ seasons: [] });
  try {
    return NextResponse.json({ seasons: await provider.getSeasons(externalId) });
  } catch (error) {
    console.warn(`[media] ${provider.id} seasons failed:`, error);
    return NextResponse.json({ seasons: [], error: "Sezonlar şu an alınamadı." }, { status: 502 });
  }
}
