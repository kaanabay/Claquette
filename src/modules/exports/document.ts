// Lists leave the app as files: Excel (XLSX), CSV and plain text; PDF is the print view. Pure:
// route handlers load an ExportDoc (queries.ts) and pick a writer here.
import { strToU8, zipSync } from "fflate";
import { formatTitle, nativeTitle, splitTitle } from "@/modules/media/titles";

export type ExportItem = {
  /** Shared lists: the round ("Kasım 2026"), "Öneri" or "Havuz". Personal lists: null. */
  group: string | null;
  rank: number | null;
  /** The Turkish title, the original and its Latin stand-in (see media/titles.ts). */
  title: string;
  originalTitle: string | null;
  internationalTitle: string | null;
  /** A season of a series ("Lost · 2. Sezon"). */
  seasonNumber: number | null;
  year: number | null;
  creators: string[];
  type: string;
  icon: string;
  imageUrl: string | null;
  /** Personal list: the owner's note. Shared list: why it was suggested. */
  note: string | null;
  status: string | null;
  addedBy: string | null;
  /** Average rating (1–10) and how many people rated. */
  rating: number | null;
  ratingCount: number;
  /** Shared lists: the exporting user's own progress and rating. */
  myStatus: string | null;
  myRating: number | null;
  link: string | null;
  addedAt: Date;
};

export type ExportDoc = { kind: "list" | "challenge"; title: string; subtitle: string; items: ExportItem[] };

export const EXPORT_FORMATS = ["xlsx", "csv", "txt"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export type Cell = string | number | null;
export type Sheet = { name: string; columns: string[]; rows: Cell[][] };

const dayFormat = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul" }); // 2026-10-23
export const formatDay = (date: Date) => dayFormat.format(date);
export const formatRating = (rating: number) => (Math.round(rating * 10) / 10).toString();
const rounded = (rating: number | null) => (rating === null ? null : Math.round(rating * 10) / 10);

/** Lead name, Turkish name when different, and the original in its own script when the lead stands in for it. */
const nameCells = (item: ExportItem): Cell[] => {
  const { lead, local } = splitTitle(item);
  return [lead, local, nativeTitle(item), item.seasonNumber];
};
const NAME_COLUMNS = ["Başlık", "Türkçe adı", "Özgün yazımı", "Sezon"];

export function toTable(doc: ExportDoc): { columns: string[]; rows: Cell[][] } {
  if (doc.kind === "list") {
    return {
      columns: ["Sıra", ...NAME_COLUMNS, "Yıl", "Yaratıcılar", "Tür", "Not", "Eklenme", "Bağlantı"],
      rows: doc.items.map((item, index) => [
        item.rank ?? index + 1,
        ...nameCells(item),
        item.year,
        item.creators.join(", ") || null,
        item.type,
        item.note,
        formatDay(item.addedAt),
        item.link,
      ]),
    };
  }
  return {
    columns: [
      "Tur",
      ...NAME_COLUMNS,
      "Yıl",
      "Yaratıcılar",
      "Tür",
      "Durum",
      "Ekleyen",
      "Eklenme",
      "Ortalama puan",
      "Puan sayısı",
      "Benim durumum",
      "Benim puanım",
      "Not",
      "Bağlantı",
    ],
    rows: doc.items.map((item) => [
      item.group,
      ...nameCells(item),
      item.year,
      item.creators.join(", ") || null,
      item.type,
      item.status,
      item.addedBy,
      formatDay(item.addedAt),
      rounded(item.rating),
      item.ratingCount || null,
      item.myStatus,
      item.myRating,
      item.note,
      item.link,
    ]),
  };
}

// Spreadsheet apps run cells starting with these as formulas; a leading ' keeps them text.
const FORMULA_START = /^[=+\-@\t\r]/;

function csvCell(value: Cell): string {
  if (value === null) return "";
  if (typeof value === "number") return String(value);
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180 CSV with a BOM, so Excel reads Turkish letters right. */
export function toCsv(doc: ExportDoc): string {
  const { columns, rows } = toTable(doc);
  return `﻿${[columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

/** One line per item: "1. Stalker (İz Sürücü), 1979 — Andrei Tarkovsky". */
function itemLine(doc: ExportDoc, item: ExportItem, index: number): string {
  const head = doc.kind === "list" ? `${item.rank ?? index + 1}. ` : "- ";
  const year = item.year ? `, ${item.year}` : "";
  const creators = item.creators.length > 0 ? ` — ${item.creators.join(", ")}` : "";
  const extra = [
    item.status,
    item.rating !== null ? `ort. ${formatRating(item.rating)}/10` : null,
    item.myRating !== null ? `benim puanım ${item.myRating}/10` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return `${head}${formatTitle(item)}${year}${creators}${extra ? ` [${extra}]` : ""}`;
}

/** A readable list: numbered for personal lists, grouped by round for shared ones. */
export function toTxt(doc: ExportDoc): string {
  const lines = [doc.title, doc.subtitle, ""];
  let group: string | null | undefined;
  doc.items.forEach((item, index) => {
    if (doc.kind === "challenge" && item.group !== group) {
      if (group !== undefined) lines.push("");
      lines.push(`## ${item.group ?? "Diğer"}`);
      group = item.group;
    }
    lines.push(itemLine(doc, item, index));
    if (item.note) lines.push(...item.note.split(/\r?\n/).map((line) => `   ${line}`));
  });
  return `${lines.join("\n")}\n`;
}

// --- XLSX: a minimal SpreadsheetML package (inline strings, a bold frozen header row) -----------

// XML 1.0 can't carry control characters other than tab and line breaks.
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
const XML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const xml = (text: string) => text.replace(INVALID_XML, "").replace(/[&<>"]/g, (char) => XML_ESCAPES[char]);

/** 0 → A, 25 → Z, 26 → AA */
export function columnName(index: number): string {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

/**
 * Excel's rules for sheet names: at most 31 characters, none of : \ / ? * [ ], not starting or
 * ending with ', and unique regardless of case.
 */
export function sheetNames(wanted: readonly string[]): string[] {
  const used = new Set<string>();
  return wanted.map((name, index) => {
    const base = name.replace(/[:\\/?*[\]]/g, " ").replace(/^'+|'+$/g, "").replace(/\s+/g, " ").trim().slice(0, 31) || `Sayfa ${index + 1}`;
    let candidate = base;
    for (let n = 2; used.has(candidate.toLocaleLowerCase("tr-TR")); n++) {
      const suffix = ` (${n})`;
      candidate = `${base.slice(0, 31 - suffix.length).trimEnd()}${suffix}`;
    }
    used.add(candidate.toLocaleLowerCase("tr-TR"));
    return candidate;
  });
}

function xlsxCell(value: Cell, ref: string, style: number): string {
  if (value === null) return "";
  const s = style ? ` s="${style}"` : "";
  if (typeof value === "number") return `<c r="${ref}"${s}><v>${value}</v></c>`;
  return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";

function sheetXml({ columns, rows }: Sheet): string {
  const widths = columns.map((column, index) =>
    Math.min(60, Math.max(8, column.length, ...rows.map((row) => String(row[index] ?? "").length)) + 2),
  );
  const row = (values: Cell[], r: number, style: number) =>
    `<row r="${r}">${values.map((value, c) => xlsxCell(value, `${columnName(c)}${r}`, style)).join("")}</row>`;
  return (
    `${XML_HEAD}<worksheet xmlns="${MAIN_NS}">` +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${widths.map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join("")}</cols>` +
    `<sheetData>${row(columns, 1, 1)}${rows.map((values, i) => row(values, i + 2, 0)).join("")}</sheetData>` +
    "</worksheet>"
  );
}

const STYLES =
  `${XML_HEAD}<styleSheet xmlns="${MAIN_NS}">` +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  "</styleSheet>";

/** A workbook with one sheet per entry (names made Excel-safe). */
export function toWorkbook(sheets: readonly Sheet[]): Uint8Array {
  const names = sheetNames(sheets.map((sheet) => sheet.name));
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        sheets
          .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
          .join("") +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        "</Types>",
    ),
    "_rels/.rels": strToU8(
      `${XML_HEAD}<Relationships xmlns="${PKG_REL_NS}"><Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    "xl/workbook.xml": strToU8(
      `${XML_HEAD}<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}"><sheets>` +
        names.map((name, i) => `<sheet name="${xml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
        "</sheets></workbook>",
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `${XML_HEAD}<Relationships xmlns="${PKG_REL_NS}">` +
        sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL_NS}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
        `<Relationship Id="rId${sheets.length + 1}" Type="${REL_NS}/styles" Target="styles.xml"/>` +
        "</Relationships>",
    ),
    "xl/styles.xml": strToU8(STYLES),
  };
  sheets.forEach((sheet, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(sheet));
  });
  return zipSync(files);
}

export const toXlsx = (doc: ExportDoc): Uint8Array => toWorkbook([{ name: "Liste", ...toTable(doc) }]);

const TURKISH_ASCII: Record<string, string> = { ç: "c", ğ: "g", ı: "i", İ: "I", ö: "o", ş: "s", ü: "u", Ç: "C", Ğ: "G", Ö: "O", Ş: "S", Ü: "U" };

/** "2026 Top 10" → "2026-top-10" (ASCII, for file names). */
export function fileSlug(title: string): string {
  const slug = title
    .replace(/[çğıİöşüÇĞÖŞÜ]/g, (char) => TURKISH_ASCII[char])
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .slice(0, 60)
    .replace(/-+$/, "");
  return slug || "liste";
}
