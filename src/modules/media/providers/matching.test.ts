import { describe, expect, it } from "vitest";
import { collapseEditions, matchesPerson, normalizeQuery, titleFold } from "./matching";

describe("normalizeQuery", () => {
  it("ignores case and extra spaces", () => {
    expect(normalizeQuery("  Usta   ile ")).toBe("usta ile");
    expect(normalizeQuery("İz Sürücü")).toBe("iz sürücü");
  });
});

describe("titleFold", () => {
  it("compares titles without case, accents or punctuation", () => {
    expect(titleFold("Usta Ile Margarita")).toBe(titleFold("usta ile margarita"));
    expect(titleFold("Kürk Mantolu Madonna.")).toBe("kurk mantolu madonna");
  });
});

describe("matchesPerson", () => {
  it("accepts other spellings of a name", () => {
    expect(matchesPerson("tarkovski", ["Andrei Tarkovsky"])).toBe(true);
    expect(matchesPerson("andrey tarkovski", ["Andrei Tarkovsky"])).toBe(true);
    expect(matchesPerson("kurosava", ["Akira Kurosawa"])).toBe(true);
    expect(matchesPerson("kieslowski", ["Krzysztof Kieślowski"])).toBe(true);
    expect(matchesPerson("ozu", ["Yasujirō Ozu"])).toBe(true);
  });

  it("looks at every name a person goes by", () => {
    expect(matchesPerson("bulgakov", ["Михаил Афанасьевич Булгаков", "Mikhail Bulgakov"])).toBe(true);
  });

  it("doesn't take titles for people", () => {
    expect(matchesPerson("usta ile margarita", ["Mikhail Bulgakov"])).toBe(false);
    expect(matchesPerson("stalker 1979", ["Stalker Smith"])).toBe(false);
    expect(matchesPerson("ab", ["Abbas Kiarostami"])).toBe(false);
  });
});

describe("collapseEditions", () => {
  const book = (title: string, authors: string[], turkish: boolean, hasCover = true) => ({ title, authors, turkish, hasCover });

  it("folds the editions of one book into one row, Turkish ones first", () => {
    const rows = collapseEditions([
      book("Master i Margarita", ["Mikhail Bulgakov"], false),
      book("Usta ile Margarita", ["Mikhail Bulgakov"], true, false),
      book("Usta Ile Margarita", ["Mihail Afanasyevic Bulgakov"], true),
      book("Usta ile Margarita", ["Bulgakov Mihail"], true),
      book("Usta Ile Ayi", ["John Yeoman"], true),
    ]);
    expect(rows.map((row) => [row.item.title, row.editions])).toEqual([
      ["Usta Ile Margarita", 3],
      ["Usta Ile Ayi", 1],
      ["Master i Margarita", 1],
    ]);
    expect(rows[0].item.hasCover).toBe(true);
  });

  it("keeps same-titled books apart unless their authors share a name", () => {
    expect(collapseEditions([book("Ana", ["Gorki"], true), book("Ana", ["Pearl Buck"], true)])).toHaveLength(2);
    // A shared surname is enough: sources spell first names differently ("Mihail", "Mikhail").
    expect(collapseEditions([book("Dune", ["Frank Herbert"], false), book("Dune", ["F. Herbert"], false)])).toHaveLength(1);
  });
});
