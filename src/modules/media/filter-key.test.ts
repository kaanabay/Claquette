import { describe, expect, it } from "vitest";
import { matchesWords, searchWords } from "@/lib/search-text";
import { mediaFilterKey } from "./filter-key";

const finds = (key: { text?: string }, query: string) => matchesWords(key.text ?? "", searchWords(query));

describe("mediaFilterKey", () => {
  const stalker = mediaFilterKey(
    {
      title: "İz Sürücü",
      originalTitle: "Сталкер",
      internationalTitle: "Stalker",
      seasonNumber: null,
      mediaType: "movie",
      creators: ["Andrei Tarkovsky"],
      year: 1979,
    },
    ["Ayşe Yılmaz"],
  );

  it("finds an item by every name it has, its people, its year and who added it", () => {
    expect(stalker.type).toBe("movie");
    for (const query of ["stalker", "iz surucu", "сталкер", "tarkovsky", "1979", "ayse"]) expect(finds(stalker, query)).toBe(true);
    expect(finds(stalker, "solaris")).toBe(false);
  });

  it("finds a season by its number", () => {
    const lost = mediaFilterKey({ title: "Lost", originalTitle: null, seasonNumber: 2, mediaType: "tv", creators: [], year: 2005 });
    expect(finds(lost, "lost 2. sezon")).toBe(true);
    expect(finds(lost, "lost 3. sezon")).toBe(false);
  });
});
