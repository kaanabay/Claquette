// Searching what a page shows (pure; server and client). Case, accents and the Turkish i fold alike:
// "isik" finds "Işık", "kieslowski" finds "Kieślowski", "lost 2" finds "Lost · 2. Sezon".

/**
 * What a page's item is found by: its media type (for the type filter) and its folded search text.
 * Something that holds items of several types (a personal list's card) names them all in `types`.
 */
export type FilterKey = { type?: string; types?: readonly string[]; text?: string };

/** Lower case without accents, dotted and dotless i alike, punctuation as single spaces. */
export function foldForSearch(text: string): string {
  return text
    .replace(/İ/g, "i")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ı/g, "i")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** The words of a query, folded; an item matches when it holds every one of them. */
export const searchWords = (query: string): string[] => foldForSearch(query).split(" ").filter(Boolean);

/** Whether folded text holds every word, also inside a longer word ("dun" finds "Dune"). */
export const matchesWords = (folded: string, words: readonly string[]) => words.every((word) => folded.includes(word));

/** An item's search text: its names, people and year, folded into one line. */
export const searchText = (parts: readonly (string | number | null | undefined)[]) =>
  foldForSearch(parts.filter((part) => part !== null && part !== undefined && part !== "").join(" "));
