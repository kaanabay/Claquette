import { describe, expect, it } from "vitest";
import { describeExisting, externalKey, itemKey, titleKey } from "./keys";

describe("titleKey", () => {
  it("ignores case, punctuation and spacing, Turkish letters included", () => {
    expect(titleKey("movie", "Üç Renk: Mavi")).toBe(titleKey("movie", "ÜÇ RENK   MAVİ"));
    expect(titleKey("book", "Tutunamayanlar!")).toBe("book|tutunamayanlar");
  });

  it("keeps different types and seasons apart", () => {
    expect(titleKey("book", "Dune")).not.toBe(titleKey("movie", "Dune"));
    expect(titleKey("tv", "Lost", 1)).not.toBe(titleKey("tv", "Lost", 2));
    expect(titleKey("tv", "Lost", 1)).not.toBe(titleKey("tv", "Lost"));
  });
});

describe("describeExisting", () => {
  it("lists every row by id, provider id when imported, and title", () => {
    const existing = describeExisting([
      { id: "a", source: "tmdb", externalId: "movie:1", title: "Stalker", originalTitle: null, mediaType: "movie" },
      { id: "b", source: "manual", externalId: null, title: "Ev Filmi", originalTitle: null, mediaType: "movie" },
    ]);
    expect(existing.keys).toEqual([itemKey("a"), externalKey("tmdb", "movie:1"), itemKey("b")]);
    expect(existing.titles).toEqual(["movie|stalker", "movie|ev filmi"]);
    expect(existing.links).toEqual({});
  });

  it("knows an item by every name it goes by", () => {
    const existing = describeExisting([
      { id: "a", source: "tmdb", externalId: "movie:1398", title: "İz Sürücü", originalTitle: "Сталкер", internationalTitle: "Stalker", mediaType: "movie" },
    ]);
    expect(existing.titles).toEqual(["movie|iz sürücü", "movie|сталкер", "movie|stalker"]);
  });

  it("points every key and title at the first row that has it", () => {
    const existing = describeExisting([
      { id: "a", source: "tmdb", externalId: "tv:1", title: "The Diplomat", originalTitle: null, mediaType: "tv", href: "/entries/1" },
      { id: "b", source: "tmdb", externalId: "tv:2", title: "The Diplomat", originalTitle: null, mediaType: "tv", href: "/entries/2" },
    ]);
    expect(existing.links[externalKey("tmdb", "tv:2")]).toBe("/entries/2");
    expect(existing.links["tv|the diplomat"]).toBe("/entries/1");
  });
});
