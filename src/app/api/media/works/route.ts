import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth/session";
import { worksBy } from "@/modules/media/providers";

const personSchema = z.object({
  type: z.string().min(1).max(32),
  provider: z.string().min(1).max(32),
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  kind: z.enum(["director", "writer", "actor", "author", "person"]),
});

// A person's works from a search ("Tarkovski" → his films), picked like search results.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });

  const parsed = personSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ results: [], failed: [] }, { status: 400 });
  const { type, ...person } = parsed.data;
  return NextResponse.json(await worksBy(person, type));
}
