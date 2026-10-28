import { describe, expect, it } from "vitest";
import { internationalTitleOf, mergeSearchResults, parseTmdbId, splitTitleYear } from "./tmdb";

describe("splitTitleYear", () => {
  it("reads a trailing year as a filter", () => {
    expect(splitTitleYear("Stalker 1979")).toEqual({ title: "Stalker", year: "1979" });
    expect(splitTitleYear("Persona (1966)")).toEqual({ title: "Persona", year: "1966" });
  });

  it("leaves titles that merely contain numbers alone", () => {
    expect(splitTitleYear("2001: A Space Odyssey", 2029)).toEqual({ title: "2001: A Space Odyssey", year: null });
    expect(splitTitleYear("1984", 2029)).toEqual({ title: "1984", year: null });
    expect(splitTitleYear("Blade Runner 2049", 2029)).toEqual({ title: "Blade Runner 2049", year: null });
  });
});

describe("mergeSearchResults", () => {
  const item = (id: number, title: string, popularity = 1) => ({ id, title, popularity });

  it("brings in an English-only match near the top", () => {
    const turkish = [item(1, "Stalker (2023)"), item(2, "STALKER (2026)"), item(3, "Stalker (2021)")];
    const english = [item(9, "Stalker (1979)", 9), item(2, "STALKER (2026)"), item(1, "Stalker (2023)")];
    expect(mergeSearchResults(turkish, english, 10).map((entry) => entry.id)).toEqual([1, 9, 2, 3]);
  });

  it("keeps the Turkish title of items found in both lists", () => {
    const merged = mergeSearchResults([item(5, "Üç Renk: Mavi")], [item(5, "Three Colors: Blue")], 10);
    expect(merged).toEqual([item(5, "Üç Renk: Mavi")]);
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 20 }, (_, i) => item(i, `#${i}`));
    expect(mergeSearchResults(many, [], 10)).toHaveLength(10);
  });
});

describe("parseTmdbId", () => {
  it("reads films, series and seasons of series", () => {
    expect(parseTmdbId("movie:1398")).toEqual({ kind: "movie", id: "1398", season: null });
    expect(parseTmdbId("tv:4607")).toEqual({ kind: "tv", id: "4607", season: null });
    expect(parseTmdbId("tv:4607:s2")).toEqual({ kind: "tv", id: "4607", season: 2 });
  });

  it("rejects anything else, films with seasons and season 0 included", () => {
    for (const id of ["movie:1398:s1", "tv:4607:s0", "tv:abc", "book:1", "tv:4607:2"]) expect(parseTmdbId(id)).toBeNull();
  });
});

describe("internationalTitleOf", () => {
  it("takes the English title for originals in another script", () => {
    expect(internationalTitleOf("Сталкер", "Stalker")).toBe("Stalker");
    expect(internationalTitleOf("東京物語", "Tokyo Story")).toBe("Tokyo Story");
  });

  it("needs no stand-in for Latin originals, nor one that isn't Latin itself", () => {
    expect(internationalTitleOf("La dolce vita", "La Dolce Vita")).toBeNull();
    expect(internationalTitleOf("Сталкер", "Сталкер")).toBeNull();
    expect(internationalTitleOf("Сталкер", undefined)).toBeNull();
    expect(internationalTitleOf(null, "Stalker")).toBeNull();
  });
});
