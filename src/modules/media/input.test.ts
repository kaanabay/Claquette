import { describe, expect, it } from "vitest";
import { z } from "zod";
import { readMediaToAdd } from "./input";
import { MAX_BATCH } from "./types";

const film = { key: "tmdb:movie:1", label: "Stalker", source: "external", mediaType: "movie", provider: "tmdb", externalId: "movie:1" };
const pick = {
  key: "item:5b0c5f4e-8a3c-4c0e-9f1a-2d7e6b9c1a00",
  label: "Dune",
  source: "catalog",
  mediaType: "book",
  mediaItemId: "5b0c5f4e-8a3c-4c0e-9f1a-2d7e6b9c1a00",
};

describe("readMediaToAdd", () => {
  it("reads the picked items and a typed-in one, in that order", () => {
    const result = readMediaToAdd({ items: JSON.stringify([film, pick]), source: "manual", mediaType: "movie", title: " Ev Filmi " });
    expect(result.ok && result.items.map((item) => [item.key, item.label, item.media.kind])).toEqual([
      ["tmdb:movie:1", "Stalker", "external"],
      [pick.key, "Dune", "catalog"],
      ["manual", "Ev Filmi", "manual"],
    ]);
  });

  it("skips the manual fields while the title is empty", () => {
    const result = readMediaToAdd({ items: JSON.stringify([film]), source: "manual", mediaType: "movie", title: "  " });
    expect(result.ok && result.items).toHaveLength(1);
    expect(readMediaToAdd({ items: "[]" })).toEqual({ ok: true, items: [] });
  });

  it("reports a broken or oversized selection under `items`", () => {
    for (const items of ["{oops", JSON.stringify([{ ...film, externalId: "" }]), JSON.stringify(Array(MAX_BATCH + 1).fill(film))]) {
      const result = readMediaToAdd({ items });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(z.flattenError(result.error).fieldErrors).toHaveProperty("items");
    }
  });

  it("reports manual field problems under their own names", () => {
    const result = readMediaToAdd({ items: "[]", source: "manual", mediaType: "movie", title: "Ev Filmi", year: "12" });
    expect(!result.ok && z.flattenError(result.error).fieldErrors).toHaveProperty("year");
  });
});
