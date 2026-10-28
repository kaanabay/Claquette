import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { type AccountData, buildAccountArchive } from "./archive";
import type { ExportDoc, ExportItem } from "./document";

const item = (title: string, overrides: Partial<ExportItem> = {}): ExportItem => ({
  group: null,
  rank: null,
  title,
  originalTitle: null,
  internationalTitle: null,
  seasonNumber: null,
  year: null,
  creators: [],
  type: "Film",
  icon: "🎬",
  imageUrl: null,
  note: null,
  status: null,
  addedBy: null,
  rating: null,
  ratingCount: 0,
  myStatus: null,
  myRating: null,
  link: null,
  addedAt: new Date("2026-10-20T12:00:00Z"),
  ...overrides,
});

const doc = (kind: ExportDoc["kind"], title: string, items: ExportItem[]): ExportDoc => ({ kind, title, subtitle: "", items });

const data: AccountData = {
  exportedAt: new Date("2026-10-28T18:00:00Z"),
  user: { name: "Kaan Abay", username: "kaan", email: "kaan@example.com", joinedAt: new Date("2026-10-16T10:00:00Z") },
  personalLists: [
    { doc: doc("list", "2026 Top 10", [item("İz Sürücü", { originalTitle: "Сталкер", internationalTitle: "Stalker", rank: 1 })]), visibility: "public" },
    { doc: doc("list", "2026 top 10", []), visibility: "private" },
  ],
  groups: [
    {
      name: "Pazar Sineması",
      lists: [doc("challenge", "Auteur Sineması", [item("Persona", { group: "Mart 2026", status: "Tamamlandı", myRating: 9 })])],
      boards: [
        { name: "Grup panosu", notes: [] },
        {
          name: "Auteur Sineması",
          notes: [{ title: "Yönetmen havuzu", body: "[ ] Bergman\n[x] Tarkovski", author: "Kaan Abay", isPinned: true, createdAt: new Date(), updatedAt: new Date() }],
        },
      ],
    },
  ],
  notes: [{ group: "Pazar Sineması", list: "Auteur Sineması", item: "Persona", visibility: "private", isSpoiler: false, body: "Finali tekrar izle.", createdAt: new Date() }],
};

describe("buildAccountArchive", () => {
  const files = unzipSync(buildAccountArchive(data));

  it("puts every list, board and note into the archive, with unique file names", () => {
    expect(Object.keys(files).sort()).toEqual([
      "BENIOKU.txt",
      "claquette-verilerim.xlsx",
      "kisisel-listeler/2026-top-10-2.csv",
      "kisisel-listeler/2026-top-10-2.txt",
      "kisisel-listeler/2026-top-10.csv",
      "kisisel-listeler/2026-top-10.txt",
      "notlarim.txt",
      "ortak-listeler/pazar-sinemasi/auteur-sinemasi.csv",
      "ortak-listeler/pazar-sinemasi/auteur-sinemasi.txt",
      "pano/pazar-sinemasi/auteur-sinemasi.txt",
      "pano/pazar-sinemasi/grup-panosu.txt",
      "veriler.json",
    ]);
  });

  it("names items as Original (Turkish) in the text files", () => {
    expect(strFromU8(files["kisisel-listeler/2026-top-10.txt"])).toContain("1. Stalker (İz Sürücü)");
    expect(strFromU8(files["pano/pazar-sinemasi/auteur-sinemasi.txt"])).toContain("=== Yönetmen havuzu · sabit");
    expect(strFromU8(files["notlarim.txt"])).toContain("Persona · Auteur Sineması (Pazar Sineması)");
  });

  it("holds one workbook sheet per list plus contents, notes and boards", () => {
    const workbook = unzipSync(files["claquette-verilerim.xlsx"]);
    const names = [...strFromU8(workbook["xl/workbook.xml"]).matchAll(/<sheet name="([^"]+)"/g)].map((match) => match[1]);
    expect(names).toEqual(["İçindekiler", "2026 Top 10", "2026 top 10 (2)", "Auteur Sineması", "Notlarım", "Pano"]);
  });

  it("keeps a machine-readable copy of everything", () => {
    const json = JSON.parse(strFromU8(files["veriler.json"]));
    expect(json.user.email).toBe("kaan@example.com");
    expect(json.groups[0].lists[0].items[0].myRating).toBe(9);
  });
});
