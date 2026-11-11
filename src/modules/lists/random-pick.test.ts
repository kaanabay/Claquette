import { describe, expect, it } from "vitest";
import { drawPick, emptyPickMessage, PICK_LINES, pickButtonLabel, pickLine, pickVerbs, randomIndex } from "./random-pick";

/** A repeatable "random": cycles through the given values. */
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe("randomIndex", () => {
  it("stays in range, even for a random() of almost 1", () => {
    expect(randomIndex(3, () => 0.9999999)).toBe(2);
    expect(randomIndex(3, () => 0)).toBe(0);
    expect(randomIndex(1, () => 0.7)).toBe(0);
  });

  it("never lands on the one to avoid when there is another", () => {
    for (const value of [0, 0.2, 0.5, 0.8, 0.9999]) {
      expect(randomIndex(3, () => value, 1)).not.toBe(1);
      expect(randomIndex(2, () => value, 0)).toBe(1);
    }
    expect(randomIndex(1, () => 0.5, 0)).toBe(0);
  });
});

describe("drawPick", () => {
  it("ends the reel on the pick, after the others", () => {
    const { index, reel } = drawPick(["a", "b", "c"], sequence(0.5, 0.1, 0.9), { frames: 4 });
    expect(reel).toHaveLength(5);
    expect(reel.at(-1)).toBe(["a", "b", "c"][index]);
    expect(reel.slice(0, -1).every((frame) => frame !== reel.at(-1))).toBe(true);
  });

  it("avoids the last pick, and copes with one candidate or none", () => {
    expect(drawPick(["a", "b"], () => 0, { avoid: 0 }).index).toBe(1);
    expect(drawPick(["solo"], () => 0.3)).toEqual({ index: 0, reel: ["solo"] });
    expect(drawPick([], () => 0.3)).toEqual({ index: -1, reel: [] });
  });
});

describe("pick lines", () => {
  it("has plenty, every one fitted to each type", () => {
    expect(PICK_LINES.length).toBeGreaterThanOrEqual(30);
    for (const type of ["movie", "tv", "book", "podcast", "game", "other"]) {
      for (const line of PICK_LINES) {
        const text = line(pickVerbs(type));
        expect(text.trim().length).toBeGreaterThan(5);
        expect(text).not.toMatch(/undefined|etkinlik/i);
      }
    }
  });

  it("speaks of the item as it is done", () => {
    expect(PICK_LINES[0](pickVerbs("movie"))).toBe("Evren bugün bunu izlemeni istedi.");
    expect(PICK_LINES[0](pickVerbs("book"))).toBe("Evren bugün bunu okumanı istedi.");
    expect(PICK_LINES[0](pickVerbs("podcast"))).toBe("Evren bugün bunu dinlemeni istedi.");
  });

  it("never says the same line twice in a row", () => {
    const first = pickLine("movie", () => 0.4);
    for (const value of [0, 0.4, 0.9999]) expect(pickLine("movie", () => value, first.index).index).not.toBe(first.index);
  });
});

describe("labels", () => {
  it("names what the page shows", () => {
    expect(pickButtonLabel(null)).toBe("Bana bir şey seç");
    expect(pickButtonLabel("movie")).toBe("Bana bir film seç");
    expect(pickButtonLabel("tv")).toBe("Bana bir dizi seç");
  });

  it("tells nothing-there from everything-finished", () => {
    expect(emptyPickMessage("tv", 0, "all")).toBe("Listelerinde hiç dizi yok.");
    expect(emptyPickMessage(null, 0, "list")).toBe("Bu listede henüz öge yok.");
    expect(emptyPickMessage("movie", 4, "list")).toBe("Hepsini bitirmişsin, seçecek bir şey kalmadı. 🎉");
  });
});
