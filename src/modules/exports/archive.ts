// "Verilerimi indir": everything of a user in one ZIP. Pure; account.ts loads the data.
import { strToU8, zipSync } from "fflate";
import { type Cell, type ExportDoc, fileSlug, formatDay, type Sheet, toCsv, toTable, toTxt, toWorkbook } from "./document";

export type BoardNoteExport = {
  title: string | null;
  body: string;
  author: string | null;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AccountData = {
  exportedAt: Date;
  user: { name: string; username: string | null; email: string; joinedAt: Date };
  personalLists: { doc: ExportDoc; visibility: "private" | "public" }[];
  groups: {
    name: string;
    lists: ExportDoc[];
    /** The group's own board first, then one per shared list that has notes. */
    boards: { name: string; notes: BoardNoteExport[] }[];
  }[];
  /** Notes the user wrote on items of shared lists (private ones included). */
  notes: { group: string; list: string; item: string; visibility: "private" | "shared"; isSpoiler: boolean; body: string; createdAt: Date }[];
};

const stamp = new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Istanbul" });

/** File names (without extension) unique within the archive: "auteur-sinemasi", "auteur-sinemasi-2". */
function uniquePaths() {
  const used = new Set<string>();
  return (folder: string, title: string) => {
    const base = `${folder}${fileSlug(title)}`;
    let path = base;
    for (let n = 2; used.has(path); n++) path = `${base}-${n}`;
    used.add(path);
    return path;
  };
}

function boardText(group: string, board: { name: string; notes: BoardNoteExport[] }): string {
  const lines = [`${group} · ${board.name}`, ""];
  for (const note of board.notes) {
    lines.push(`=== ${note.title ?? "(başlıksız)"}${note.isPinned ? " · sabit" : ""}`);
    lines.push(`${note.author ?? "Silinmiş kullanıcı"} · ${formatDay(note.createdAt)}`, "");
    lines.push(note.body, "");
  }
  return `${lines.join("\n")}\n`;
}

function readme(data: AccountData): string {
  return `${[
    `Claquette verilerin: ${data.user.name}${data.user.username ? ` (@${data.user.username})` : ""}`,
    `Hazırlanma: ${stamp.format(data.exportedAt)}`,
    "",
    "Bu arşivde:",
    "- claquette-verilerim.xlsx: her liste ayrı bir sayfada; notların ve panolar da ayrı sayfalarda.",
    "- kisisel-listeler/: kişisel listelerin, her biri .csv ve .txt olarak.",
    "- ortak-listeler/<grup>/: üyesi olduğun gruplardaki ortak listelerin tüm ögeleri, kendi durumun ve puanınla.",
    "- pano/<grup>/: grup ve liste panolarındaki notlar.",
    "- notlarim.txt: ögelere yazdığın notlar (yalnız sana görünenler dahil).",
    "- veriler.json: hepsi, programların okuyabileceği biçimde.",
    "",
    "İsimler \"Özgün ad (Türkçe ad)\" biçiminde; tarihler Türkiye saatine göre.",
    "Film ve dizi bilgileri TMDB'den, kitap bilgileri Google Books ve Open Library'den, podcast bilgileri Apple Podcasts'ten gelir.",
  ].join("\n")}\n`;
}

export function buildAccountArchive(data: AccountData): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const add = (path: string, content: string | Uint8Array) => {
    files[path] = typeof content === "string" ? strToU8(content) : content;
  };
  const pathFor = uniquePaths();

  // One workbook with everything: a contents sheet, a sheet per list, notes and boards.
  const contents: Cell[][] = [];
  const listSheets: Sheet[] = [];
  for (const { doc, visibility } of data.personalLists) {
    contents.push([doc.title, visibility === "public" ? "Kişisel liste (herkese açık)" : "Kişisel liste (gizli)", null, doc.items.length]);
    listSheets.push({ name: doc.title, ...toTable(doc) });
    const path = pathFor("kisisel-listeler/", doc.title);
    add(`${path}.csv`, toCsv(doc));
    add(`${path}.txt`, toTxt(doc));
  }
  for (const group of data.groups) {
    const folder = `ortak-listeler/${fileSlug(group.name)}/`;
    for (const doc of group.lists) {
      contents.push([doc.title, "Ortak liste", group.name, doc.items.length]);
      listSheets.push({ name: doc.title, ...toTable(doc) });
      const path = pathFor(folder, doc.title);
      add(`${path}.csv`, toCsv(doc));
      add(`${path}.txt`, toTxt(doc));
    }
    for (const board of group.boards) add(`${pathFor(`pano/${fileSlug(group.name)}/`, board.name)}.txt`, boardText(group.name, board));
  }

  const noteRows: Cell[][] = data.notes.map((note) => [
    note.group,
    note.list,
    note.item,
    note.visibility === "private" ? "Yalnız ben" : "Grup",
    note.isSpoiler ? "Evet" : null,
    formatDay(note.createdAt),
    note.body,
  ]);
  const boardRows: Cell[][] = data.groups.flatMap((group) =>
    group.boards.flatMap((board) =>
      board.notes.map((note) => [
        group.name,
        board.name,
        note.title,
        note.body,
        note.author,
        note.isPinned ? "Evet" : null,
        formatDay(note.createdAt),
        formatDay(note.updatedAt),
      ]),
    ),
  );
  add(
    "claquette-verilerim.xlsx",
    toWorkbook([
      { name: "İçindekiler", columns: ["Liste", "Tür", "Grup", "Öge sayısı"], rows: contents },
      ...listSheets,
      { name: "Notlarım", columns: ["Grup", "Liste", "Öge", "Görünürlük", "Spoiler", "Tarih", "Not"], rows: noteRows },
      { name: "Pano", columns: ["Grup", "Pano", "Başlık", "Not", "Yazan", "Sabit", "Eklenme", "Düzenlenme"], rows: boardRows },
    ]),
  );

  add(
    "notlarim.txt",
    data.notes.length === 0
      ? "Henüz bir ögeye not yazmamışsın.\n"
      : `${data.notes
          .map((note) => `${note.item} · ${note.list} (${note.group}) · ${formatDay(note.createdAt)}${note.visibility === "private" ? " · yalnız ben" : ""}\n${note.body}\n`)
          .join("\n")}`,
  );
  add("veriler.json", `${JSON.stringify(data, null, 2)}\n`);
  add("BENIOKU.txt", readme(data));
  return zipSync(files);
}
