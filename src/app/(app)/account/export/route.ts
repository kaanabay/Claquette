import { getCurrentUser } from "@/modules/auth/session";
import { loadAccountData } from "@/modules/exports/account";
import { buildAccountArchive } from "@/modules/exports/archive";
import { fileSlug, formatDay } from "@/modules/exports/document";

/** "Verilerimi indir": the signed-in user's data as one ZIP. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Oturum gerekli.", { status: 401 });
  const data = await loadAccountData(user.id);
  const name = `claquette-verilerim-${fileSlug(user.username ?? user.name)}-${formatDay(data.exportedAt)}.zip`;
  return new Response(buildAccountArchive(data) as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
