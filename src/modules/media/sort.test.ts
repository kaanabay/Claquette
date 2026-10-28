import { describe, expect, it } from "vitest";
import { isSortKey, type SortFields, sortRows } from "./sort";

type Row = { id: string } & SortFields;
const row = (id: string, day: string, title: string, year: number | null, extra: Partial<SortFields["media"]> = {}): Row => ({
  id,
  addedAt: new Date(`${day}T12:00:00+03:00`),
  media: { title, originalTitle: null, year, ...extra },
});

// A "watched" diary as the user keeps it: added roughly in date order, one entry back-dated.
const diary: Row[] = [
  row("lost1", "2026-01-03", "Lost", 2004, { seasonNumber: 1 }),
  row("film1", "2026-01-06", "İz Sürücü", 1979, { originalTitle: "Сталкер", internationalTitle: "Stalker" }),
  row("lost2", "2026-02-12", "Lost", 2005, { seasonNumber: 2 }),
  row("prison", "2026-02-20", "Prison Break", 2005, { seasonNumber: 1 }),
  row("late", "2026-01-08", "Ayna", null),
];
const ids = (rows: Row[]) => rows.map((entry) => entry.id);

describe("sortRows", () => {
  it("keeps the list's own order for manual", () => {
    expect(ids(sortRows(diary, "manual", (entry) => entry))).toEqual(["lost1", "film1", "lost2", "prison", "late"]);
  });

  it("sorts by date either way", () => {
    expect(ids(sortRows(diary, "oldest", (entry) => entry))).toEqual(["lost1", "film1", "late", "lost2", "prison"]);
    expect(ids(sortRows(diary, "newest", (entry) => entry))).toEqual(["prison", "lost2", "late", "film1", "lost1"]);
  });

  it("sorts by the name shown first, Turkish letters and seasons in order", () => {
    expect(ids(sortRows(diary, "title", (entry) => entry))).toEqual(["late", "lost1", "lost2", "prison", "film1"]);
  });

  it("sorts by year, newest first, undated last; ties keep their order", () => {
    expect(ids(sortRows(diary, "year", (entry) => entry))).toEqual(["lost2", "prison", "lost1", "film1", "late"]);
  });

  it("knows its keys", () => {
    expect(isSortKey("newest")).toBe(true);
    expect(isSortKey("random")).toBe(false);
  });
});
