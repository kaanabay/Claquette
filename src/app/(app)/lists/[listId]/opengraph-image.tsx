import { ImageResponse } from "next/og";
import { getPublicListPreview } from "@/modules/lists/queries";

// Link preview for a shared list (WhatsApp, Telegram, iMessage…): title, owner and a few covers.
// Private or missing lists get a plain card, so a preview never reveals more than the page does.

export const alt = "Claquette listesi";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const COLORS = { background: "#faf8f3", foreground: "#2b2520", muted: "#7a6f66", primary: "#e9b53c", card: "#ffffff" };

/** Covers are fetched here (with a short timeout) so one slow image host can't break the preview. */
async function toDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !/^image\/(png|jpe?g|gif)/.test(type)) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 2_000_000) return null;
    return `data:${type.split(";")[0]};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;
  const preview = await getPublicListPreview(listId);
  const covers = preview ? (await Promise.all(preview.covers.slice(0, 4).map((cover) => toDataUrl(cover.imageUrl)))).filter(Boolean) : [];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 56,
          padding: "64px 72px",
          background: COLORS.background,
          color: COLORS.foreground,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, color: COLORS.muted }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: COLORS.primary }} />
            Claquette
          </div>
          <div style={{ display: "flex", fontSize: preview && preview.title.length > 28 ? 60 : 76, lineHeight: 1.08, letterSpacing: -1.5 }}>
            {preview?.title ?? "Bir Claquette listesi"}
          </div>
          {preview ? (
            <div style={{ display: "flex", fontSize: 32, color: COLORS.muted }}>
              {`Hazırlayan: ${preview.ownerName} · ${preview.countsLabel}`}
            </div>
          ) : null}
        </div>
        {covers.length > 0 ? (
          <div style={{ display: "flex", position: "relative", width: 360, height: 470 }}>
            {covers.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src!}
                alt=""
                width={240}
                height={360}
                style={{
                  position: "absolute",
                  top: 20 + i * 18,
                  left: i * 38,
                  width: 240,
                  height: 360,
                  objectFit: "cover",
                  borderRadius: 14,
                  border: `6px solid ${COLORS.card}`,
                  boxShadow: "0 18px 40px rgba(43, 37, 32, 0.25)",
                  transform: `rotate(${(i - 1.5) * 4}deg)`,
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
    ),
    size,
  );
}
