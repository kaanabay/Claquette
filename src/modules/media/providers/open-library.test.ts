import { describe, expect, it } from "vitest";
import { openLibraryResult, parseOpenLibraryId } from "./open-library";

describe("openLibraryResult", () => {
  const bulgakov = { key: "/works/OL676009W", title: "Мастер и Маргарита", author_name: ["Михаил Булгаков"], first_publish_year: 1966 };

  it("names a work by its Turkish edition and remembers that edition", () => {
    const result = openLibraryResult({
      ...bulgakov,
      editions: { docs: [{ key: "/books/OL26461504M", title: "Usta ile Margarita", language: ["tur"] }] },
    });
    expect(result.title).toBe("Usta ile Margarita");
    expect(result.originalTitle).toBeNull(); // the Russian original isn't a Latin-script lead
    expect(result.externalId).toBe("OL676009W:OL26461504M");
    expect(result.creators).toEqual([]); // names in other scripts are left to the details
  });

  it("keeps a Latin original next to the Turkish title", () => {
    const result = openLibraryResult({
      key: "/works/OL27482W",
      title: "The Hobbit",
      editions: { docs: [{ key: "/books/OL1M", title: "Hobbit", language: ["tur"] }] },
    });
    expect([result.title, result.originalTitle]).toEqual(["Hobbit", "The Hobbit"]);
  });

  it("falls back to a Latin-script title without a Turkish edition", () => {
    const french = { editions: { docs: [{ key: "/books/OL2M", title: "Coeur de chien", language: ["fre"] }] } };
    expect(openLibraryResult({ ...bulgakov, ...french }).title).toBe("Coeur de chien");
    expect(openLibraryResult({ ...bulgakov, ...french }).externalId).toBe("OL676009W");
    expect(openLibraryResult({ key: "/works/OL5W", title: "Tutunamayanlar" }).title).toBe("Tutunamayanlar");
  });
});

describe("parseOpenLibraryId", () => {
  it("reads a work with or without the edition to name it by", () => {
    expect(parseOpenLibraryId("OL676009W")).toEqual({ work: "OL676009W", edition: null });
    expect(parseOpenLibraryId("OL676009W:OL26461504M")).toEqual({ work: "OL676009W", edition: "OL26461504M" });
    expect(parseOpenLibraryId("OL1M")).toBeNull();
  });
});
