import { describe, expect, it } from "vitest";
import { canViewList, describeItemCounts, isSameItemSet } from "./domain";

describe("canViewList", () => {
  it("opens public lists to everyone and private ones to their owner", () => {
    expect(canViewList({ ownerId: "a", visibility: "public" }, null)).toBe(true);
    expect(canViewList({ ownerId: "a", visibility: "private" }, "a")).toBe(true);
    expect(canViewList({ ownerId: "a", visibility: "private" }, "b")).toBe(false);
    expect(canViewList({ ownerId: "a", visibility: "private" }, null)).toBe(false);
  });
});

describe("isSameItemSet", () => {
  it("accepts any permutation of the same items", () => {
    expect(isSameItemSet(["x", "y", "z"], ["z", "x", "y"])).toBe(true);
  });

  it("rejects missing, extra, unknown or repeated items", () => {
    expect(isSameItemSet(["x", "y"], ["x"])).toBe(false);
    expect(isSameItemSet(["x", "y"], ["x", "y", "z"])).toBe(false);
    expect(isSameItemSet(["x", "y"], ["x", "q"])).toBe(false);
    expect(isSameItemSet(["x", "y"], ["x", "x"])).toBe(false);
  });
});

describe("describeItemCounts", () => {
  it("names counts per media type, largest first", () => {
    expect(describeItemCounts([{ mediaType: "movie", total: 10 }])).toBe("10 film");
    expect(
      describeItemCounts([
        { mediaType: "movie", total: 2 },
        { mediaType: "book", total: 3 },
      ]),
    ).toBe("3 kitap · 2 film");
  });

  it("merges unknown types and falls back to a plain count", () => {
    expect(
      describeItemCounts([
        { mediaType: "comic", total: 1 },
        { mediaType: "other", total: 2 },
      ]),
    ).toBe("3 öge");
    expect(
      describeItemCounts([
        { mediaType: "movie", total: 1 },
        { mediaType: "book", total: 1 },
        { mediaType: "tv", total: 1 },
        { mediaType: "game", total: 1 },
      ]),
    ).toBe("4 öge");
    expect(describeItemCounts([])).toBe("Henüz boş");
  });
});
