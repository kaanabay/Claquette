import { describe, expect, it } from "vitest";
import { allTitles, formatTitle, isLatinText, leadTitle, nativeTitle, splitTitle } from "./titles";

describe("formatTitle", () => {
  it("leads with the original and puts the Turkish title in parentheses", () => {
    expect(formatTitle({ title: "Tatlı Hayat", originalTitle: "La dolce vita" })).toBe("La dolce vita (Tatlı Hayat)");
    expect(formatTitle({ title: "Baba II", originalTitle: "The Godfather Part II" })).toBe("The Godfather Part II (Baba II)");
  });

  it("uses the international title when the original is in another script", () => {
    expect(formatTitle({ title: "İz Sürücü", originalTitle: "Сталкер", internationalTitle: "Stalker" })).toBe("Stalker (İz Sürücü)");
    expect(formatTitle({ title: "Tokyo Hikayesi", originalTitle: "東京物語", internationalTitle: "Tokyo Story" })).toBe("Tokyo Story (Tokyo Hikayesi)");
  });

  it("names a season of a series after the series", () => {
    expect(formatTitle({ title: "Lost", originalTitle: null, seasonNumber: 2 })).toBe("Lost · 2. Sezon");
    expect(formatTitle({ title: "Para Soygunu", originalTitle: "La casa de papel", seasonNumber: 1 })).toBe("La casa de papel (Para Soygunu) · 1. Sezon");
  });

  it("falls back to the original script when no international title is known", () => {
    expect(formatTitle({ title: "İz Sürücü", originalTitle: "Сталкер" })).toBe("Сталкер (İz Sürücü)");
  });

  it("shows one name when there is only one, or both are the same", () => {
    expect(formatTitle({ title: "Tutunamayanlar", originalTitle: null })).toBe("Tutunamayanlar");
    expect(formatTitle({ title: "Kış Uykusu", originalTitle: "Kış uykusu" })).toBe("Kış uykusu");
    expect(formatTitle({ title: "Stalker", originalTitle: "Сталкер", internationalTitle: "Stalker" })).toBe("Stalker");
  });
});

describe("helpers", () => {
  it("tells Latin script from others; digits and symbols don't count", () => {
    expect(["8½", "Amélie", "Ça", "Üç Renk: Mavi", "2001: A Space Odyssey"].every(isLatinText)).toBe(true);
    expect(["Сталкер", "東京物語", "기생충", "طعم گیلاس"].some(isLatinText)).toBe(false);
  });

  it("splits, names the native original and lists every name", () => {
    const stalker = { title: "İz Sürücü", originalTitle: "Сталкер", internationalTitle: "Stalker" };
    expect(splitTitle(stalker)).toEqual({ lead: "Stalker", local: "İz Sürücü" });
    expect(leadTitle({ title: "Dune", originalTitle: null })).toBe("Dune");
    expect(nativeTitle(stalker)).toBe("Сталкер");
    expect(nativeTitle({ title: "Tatlı Hayat", originalTitle: "La dolce vita" })).toBeNull();
    expect(allTitles(stalker)).toEqual(["İz Sürücü", "Сталкер", "Stalker"]);
  });
});
