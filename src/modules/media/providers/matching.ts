// Search helpers (pure): comparing names across spellings, and folding the many editions of one
// book into a single result.

/** "  Usta   ile " → "usta ile": the same search shares one cache entry (and one provider call). */
export function normalizeQuery(query: string): string {
  return query.replace(/\s+/g, " ").trim().replace(/İ/g, "i").toLowerCase().slice(0, 100);
}

/** Lower case without accents or Turkish dotless i: "Kieślowski" → "kieslowski", "Işık" → "isik". */
const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").replace(/ı/g, "i").toLowerCase();

/** A title to compare: case, accents and punctuation ignored ("Usta Ile Margarita" = "usta ile margarita"). */
export const titleFold = (title: string) => fold(title).replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const words = (text: string) => fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/**
 * Whether one of a person's names answers the query, across spellings: every word typed (three
 * letters or more) starts like a word of the name ("tarkovski" ~ "Tarkovsky", "kurosava" ~
 * "Kurosawa"). A year in the query means a title search, not a person.
 */
export function matchesPerson(query: string, names: readonly string[]): boolean {
  const typed = words(query).filter((word) => word.length >= 3);
  if (typed.length === 0 || typed.some((word) => /\d/.test(word))) return false;
  return names.some((name) => {
    const parts = words(name);
    return typed.every((word) => parts.some((part) => part.startsWith(word.slice(0, 4))));
  });
}

export type Edition = { title: string; authors: readonly string[]; turkish: boolean; hasCover: boolean };

const authorWords = (edition: Edition) => new Set(edition.authors.flatMap(words).filter((word) => word.length >= 3));
const sameBook = (a: Edition, b: Edition) => {
  if (titleFold(a.title) !== titleFold(b.title)) return false;
  const left = authorWords(a);
  const right = authorWords(b);
  return left.size === 0 || right.size === 0 || [...left].some((word) => right.has(word));
};
const rank = (edition: Edition) => (edition.turkish ? 2 : 0) + (edition.hasCover ? 1 : 0);

/**
 * One row per book: Turkish editions first, and editions with the same title and a shared author
 * word folded into the best one (Turkish, with a cover), which keeps the group's place.
 */
export function collapseEditions<T extends Edition>(items: readonly T[]): { item: T; editions: number }[] {
  const ordered = [...items].sort((a, b) => Number(b.turkish) - Number(a.turkish));
  const groups: { item: T; editions: number }[] = [];
  for (const item of ordered) {
    const group = groups.find((entry) => sameBook(entry.item, item));
    if (!group) groups.push({ item, editions: 1 });
    else {
      group.editions += 1;
      if (rank(item) > rank(group.item)) group.item = item;
    }
  }
  return groups;
}
