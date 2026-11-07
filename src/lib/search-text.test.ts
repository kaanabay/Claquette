import { describe, expect, it } from "vitest";
import { foldForSearch, matchesWords, searchText, searchWords } from "./search-text";

describe("foldForSearch", () => {
  it("ignores case, accents, the Turkish i and punctuation", () => {
    expect(foldForSearch("Işık İSTANBUL")).toBe("isik istanbul");
    expect(foldForSearch("Kieślowski")).toBe("kieslowski");
    expect(foldForSearch("Lost · 2. Sezon")).toBe("lost 2 sezon");
    expect(foldForSearch("  Dune:   Part Two ")).toBe("dune part two");
  });
});

describe("searchWords and matchesWords", () => {
  const dune = searchText(["Dune: Part Two (Dune: Çöl Gezegeni Bölüm İki)", "Denis Villeneuve", 2024, "Kaan Abay"]);

  it("finds an item by any of its words, in any order, also by the start of one", () => {
    expect(matchesWords(dune, searchWords("dune"))).toBe(true);
    expect(matchesWords(dune, searchWords("villeneuve dun"))).toBe(true);
    expect(matchesWords(dune, searchWords("çöl"))).toBe(true);
    expect(matchesWords(dune, searchWords("col gezegeni"))).toBe(true);
    expect(matchesWords(dune, searchWords("2024"))).toBe(true);
    expect(matchesWords(dune, searchWords("kaan"))).toBe(true);
  });

  it("needs every word", () => {
    expect(matchesWords(dune, searchWords("dune nolan"))).toBe(false);
  });

  it("matches everything for an empty query", () => {
    expect(searchWords("  · ")).toEqual([]);
    expect(matchesWords(dune, searchWords(""))).toBe(true);
  });

  it("leaves out empty pieces", () => {
    expect(searchText(["Persona", null, undefined, "", 1966])).toBe("persona 1966");
  });
});
