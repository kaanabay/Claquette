import { describe, expect, it } from "vitest";
import { searchText, searchWords } from "@/lib/search-text";
import { matchesFilter } from "./item-filter";

const filter = (type: string | null, query = "") => ({ type, words: searchWords(query) });

describe("matchesFilter", () => {
  const film = { type: "movie", text: searchText(["Stalker", "Andrei Tarkovsky"]) };
  const mixedList = { types: ["tv", "movie"], text: searchText(["İzlediklerim"]) };
  const emptyList = { types: [], text: searchText(["Gizli taslak"]) };

  it("lets everything through while nothing is filtered", () => {
    expect(matchesFilter(null, film)).toBe(true);
    expect(matchesFilter(filter(null), emptyList)).toBe(true);
  });

  it("keeps an item of the chosen type", () => {
    expect(matchesFilter(filter("movie"), film)).toBe(true);
    expect(matchesFilter(filter("book"), film)).toBe(false);
  });

  it("keeps a card that holds the chosen type among others, and drops an empty one", () => {
    expect(matchesFilter(filter("movie"), mixedList)).toBe(true);
    expect(matchesFilter(filter("tv"), mixedList)).toBe(true);
    expect(matchesFilter(filter("book"), mixedList)).toBe(false);
    expect(matchesFilter(filter("movie"), emptyList)).toBe(false);
  });

  it("asks for the type and every word together", () => {
    expect(matchesFilter(filter("movie", "izlediklerim"), mixedList)).toBe(true);
    expect(matchesFilter(filter("book", "izlediklerim"), mixedList)).toBe(false);
    expect(matchesFilter(filter(null, "taslak"), emptyList)).toBe(true);
  });
});
