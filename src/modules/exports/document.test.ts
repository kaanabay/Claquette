import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { columnName, type ExportDoc, type ExportItem, fileSlug, sheetNames, toCsv, toTxt, toWorkbook, toXlsx } from "./document";

const item = (overrides: Partial<ExportItem>): ExportItem => ({
  group: null,
  rank: null,
  title: "İz Sürücü",
  originalTitle: "Сталкер",
  internationalTitle: "Stalker",
  seasonNumber: null,
  year: 1979,
  creators: ["Andrei Tarkovsky"],
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
  link: "https://www.themoviedb.org/movie/1398",
  addedAt: new Date("2026-10-23T21:30:00Z"), // 24 Ekim in Istanbul
  ...overrides,
});

const list: ExportDoc = {
  kind: "list",
  title: "2026 Top 10",
  subtitle: "Hazırlayan: Kaan",
  items: [
    item({ note: 'Yılın filmi, "kesin"' }),
    item({ title: "Tatlı Hayat", originalTitle: "La dolce vita", internationalTitle: null, year: 1960, creators: ["Federico Fellini"], link: null }),
    item({ title: "=Solaris", originalTitle: null, internationalTitle: null, year: null, creators: [], link: null }),
  ],
};

const challenge: ExportDoc = {
  kind: "challenge",
  title: "Auteur Sineması",
  subtitle: "Pazar Sineması",
  items: [
    item({ group: "Ekim 2026", status: "Tamamlandı", addedBy: "Kaan", rating: 8.666, ratingCount: 3, myStatus: "İzledim", myRating: 9, note: "İlk film\nikinci satır" }),
    item({ group: "Öneri", title: "Ayna", originalTitle: "Зеркало", internationalTitle: "Mirror", status: "Önerildi", addedBy: "Ayşe" }),
  ],
};

describe("toCsv", () => {
  it("leads with the original name, keeps formulas as text, starts with a BOM", () => {
    const csv = toCsv(list);
    expect(csv.startsWith("﻿Sıra,Başlık,Türkçe adı,Özgün yazımı,Sezon,Yıl,")).toBe(true);
    expect(csv).toContain('1,Stalker,İz Sürücü,Сталкер,,1979,Andrei Tarkovsky,Film,"Yılın filmi, ""kesin""",2026-10-24,https://www.themoviedb.org/movie/1398\r\n');
    expect(csv).toContain("2,La dolce vita,Tatlı Hayat,,,1960,Federico Fellini,Film,,2026-10-24,\r\n");
    expect(csv).toContain("3,'=Solaris,,,,,,Film,,2026-10-24,\r\n");
  });

  it("writes rounds, states, the rounded average and the exporter's own rating for shared lists", () => {
    const csv = toCsv(challenge);
    expect(csv).toContain('Ekim 2026,Stalker,İz Sürücü,Сталкер,,1979,Andrei Tarkovsky,Film,Tamamlandı,Kaan,2026-10-24,8.7,3,İzledim,9,"İlk film\nikinci satır",');
  });
});

describe("toTxt", () => {
  it("numbers personal lists, names items as Original (Turkish) and indents notes", () => {
    expect(toTxt(list)).toBe(
      "2026 Top 10\nHazırlayan: Kaan\n\n" +
        '1. Stalker (İz Sürücü), 1979 — Andrei Tarkovsky\n   Yılın filmi, "kesin"\n' +
        "2. La dolce vita (Tatlı Hayat), 1960 — Federico Fellini\n" +
        "3. =Solaris\n",
    );
  });

  it("names seasons of a series", () => {
    const diary: ExportDoc = {
      ...list,
      items: [item({ title: "Lost", originalTitle: null, internationalTitle: null, seasonNumber: 2, year: 2005, creators: [] })],
    };
    expect(toTxt(diary)).toContain("1. Lost · 2. Sezon, 2005\n");
    expect(toCsv(diary)).toContain("1,Lost,,,2,2005,");
  });

  it("groups shared lists by round", () => {
    expect(toTxt(challenge)).toContain(
      "## Ekim 2026\n- Stalker (İz Sürücü), 1979 — Andrei Tarkovsky [Tamamlandı · ort. 8.7/10 · benim puanım 9/10]\n   İlk film\n   ikinci satır\n\n## Öneri\n- Mirror (Ayna), 1979",
    );
  });
});

describe("toXlsx", () => {
  it("packs a workbook with a bold header and typed cells", () => {
    const files = unzipSync(toXlsx(challenge));
    expect(Object.keys(files).sort()).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/workbook.xml",
      "xl/worksheets/sheet1.xml",
    ]);
    const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]);
    expect(sheet).toContain('<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">Tur</t></is></c>');
    expect(sheet).toContain('<c r="B2" t="inlineStr"><is><t xml:space="preserve">Stalker</t></is></c>');
    expect(sheet).toContain('<c r="F2"><v>1979</v></c>');
    expect(sheet).toContain('<c r="L2"><v>8.7</v></c>');
    expect(sheet).not.toContain('r="L3"'); // no rating: empty cell
  });

  it("escapes markup and drops characters XML can't hold", () => {
    const sheet = strFromU8(unzipSync(toXlsx({ ...list, items: [item({ title: "Tom & Jerry <3\u0007", originalTitle: null, internationalTitle: null })] }))["xl/worksheets/sheet1.xml"]);
    expect(sheet).toContain("Tom &amp; Jerry &lt;3</t>");
  });

  it("holds several sheets with Excel-safe names", () => {
    const files = unzipSync(toWorkbook([
      { name: "2026 Top 10", columns: ["A"], rows: [] },
      { name: "2026 top 10", columns: ["A"], rows: [] },
      { name: "Kitaplar: 2027 / Çeyreklik [plan]", columns: ["A"], rows: [] },
    ]));
    const workbook = strFromU8(files["xl/workbook.xml"]);
    expect(workbook).toContain('<sheet name="2026 Top 10" sheetId="1" r:id="rId1"/>');
    expect(workbook).toContain('<sheet name="2026 top 10 (2)" sheetId="2" r:id="rId2"/>');
    expect(workbook).toContain('<sheet name="Kitaplar 2027 Çeyreklik plan" sheetId="3" r:id="rId3"/>');
    expect(Object.keys(files)).toContain("xl/worksheets/sheet3.xml");
    expect(strFromU8(files["xl/_rels/workbook.xml.rels"])).toContain('Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"');
  });
});

describe("helpers", () => {
  it("names spreadsheet columns", () => {
    expect([0, 25, 26, 51, 701, 702].map(columnName)).toEqual(["A", "Z", "AA", "AZ", "ZZ", "AAA"]);
  });

  it("keeps sheet names within 31 characters, unique", () => {
    const names = sheetNames(["Çok uzun bir ortak liste adı, gerçekten çok uzun", "Çok uzun bir ortak liste adı, gerçekten çok uzun", ""]);
    expect(names.every((name) => name.length <= 31)).toBe(true);
    expect(new Set(names).size).toBe(3);
    expect(names[2]).toBe("Sayfa 3");
  });

  it("makes ASCII file names", () => {
    expect(fileSlug("2026 Top 10")).toBe("2026-top-10");
    expect(fileSlug("Yıllık Kitaplar: Çağdaş Türk Öyküsü")).toBe("yillik-kitaplar-cagdas-turk-oykusu");
    expect(fileSlug("???")).toBe("liste");
  });
});
