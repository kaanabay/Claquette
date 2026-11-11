import { describe, expect, it } from "vitest";
import { finishDefaults, finishedNotice, itemFinish, latestFinishes, markIsVisible, rememberedChoice } from "./finishes";

const day = (iso: string) => new Date(`${iso}T12:00:00+03:00`);

describe("the dialog's starting choice", () => {
  it("keeps the item unless the list remembers otherwise", () => {
    expect(finishDefaults(null)).toEqual({ remove: false, remember: false });
    expect(finishDefaults(true)).toEqual({ remove: true, remember: true });
    expect(finishDefaults(false)).toEqual({ remove: false, remember: true });
  });

  it("remembers only when asked, and forgets when not", () => {
    expect(rememberedChoice(true, true)).toBe(true);
    expect(rememberedChoice(false, true)).toBe(false);
    expect(rememberedChoice(true, false)).toBeNull();
    expect(rememberedChoice(false, false)).toBeNull();
  });
});

describe("finishedNotice", () => {
  it("names the collection by type", () => {
    expect(finishedNotice("Stalker", "movie", false)).toBe("“Stalker” izlediklerine eklendi.");
    expect(finishedNotice("Usta ile Margarita", "book", true)).toBe("“Usta ile Margarita” okuduklarına eklendi ve listeden çıkarıldı.");
    expect(finishedNotice("Serial", "podcast", false)).toBe("“Serial” dinlediklerine eklendi.");
    expect(finishedNotice("Bir şey", "other", false)).toBe("“Bir şey” bitirdiklerine eklendi.");
  });
});

describe("itemFinish", () => {
  const auteur = { entryId: "e1", challengeTitle: "Auteur Sineması", finishedAt: day("2026-03-01") };
  const yearly = { entryId: "e2", challengeTitle: "Yılın filmleri", finishedAt: day("2026-05-01") };

  it("is nothing for an item nobody finished", () => {
    expect(itemFinish(undefined, [])).toBeNull();
  });

  it("leads with the person's own mark, keeping where they finished it last", () => {
    expect(itemFinish({ finishedAt: day("2026-01-10") }, [auteur, yearly])).toEqual({
      finishedAt: day("2026-01-10"),
      marked: true,
      entryId: "e2",
      challengeTitle: "Yılın filmleri",
    });
  });

  it("otherwise reads the latest shared list", () => {
    expect(itemFinish(undefined, [yearly, auteur])).toEqual({ finishedAt: day("2026-05-01"), marked: false, entryId: "e2", challengeTitle: "Yılın filmleri" });
  });
});

describe("latestFinishes", () => {
  it("keeps one row per item, its latest, newest first", () => {
    const rows = [
      { mediaItemId: "a", finishedAt: day("2025-02-01"), from: "mark" },
      { mediaItemId: "b", finishedAt: day("2026-01-05"), from: "shared" },
      { mediaItemId: "a", finishedAt: day("2026-04-01"), from: "shared" },
    ];
    expect(latestFinishes(rows).map((row) => `${row.mediaItemId}:${row.from}`)).toEqual(["a:shared", "b:shared"]);
  });
});

describe("markIsVisible", () => {
  it("shows others only the marks made on a public list", () => {
    expect(markIsVisible(true, "private")).toBe(true);
    expect(markIsVisible(true, null)).toBe(true);
    expect(markIsVisible(false, "public")).toBe(true);
    expect(markIsVisible(false, "private")).toBe(false);
    expect(markIsVisible(false, null)).toBe(false);
  });
});
