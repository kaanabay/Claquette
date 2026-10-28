import "server-only";
import { EXPORT_FORMATS, type ExportDoc, type ExportFormat, fileSlug, toCsv, toTxt, toXlsx } from "./document";

const CONTENT_TYPES: Record<ExportFormat, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
  txt: "text/plain; charset=utf-8",
};

const isFormat = (value: string | null): value is ExportFormat => EXPORT_FORMATS.includes(value as ExportFormat);

/** The download for `?format=`; the file name keeps the list's title (with an ASCII fallback). */
export function exportResponse(doc: ExportDoc | null, format: string | null): Response {
  if (!doc) return new Response("Liste bulunamadı.", { status: 404 });
  if (!isFormat(format)) return new Response("Bilinmeyen biçim.", { status: 400 });
  const body = format === "xlsx" ? toXlsx(doc) : format === "csv" ? toCsv(doc) : toTxt(doc);
  const name = `${doc.title.replace(/[\\/:*?"<>|\r\n]+/g, " ").trim() || "liste"}.${format}`;
  return new Response(body as BodyInit, {
    headers: {
      "Content-Type": CONTENT_TYPES[format],
      "Content-Disposition": `attachment; filename="${fileSlug(doc.title)}.${format}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
