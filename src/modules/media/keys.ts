// Keys that tell whether a search result or a pick is already in a list. Shared by the server
// (which lists what a list holds) and the picker (which marks results). Pure, no I/O.
import { allTitles, type Titled } from "./titles";

/** A catalog row imported from a provider: "tmdb:movie:123", "google_books:abc". */
export const externalKey = (source: string, externalId: string) => `${source}:${externalId}`;

/** Any catalog row, imported or typed in. */
export const itemKey = (mediaItemId: string) => `item:${mediaItemId}`;

/**
 * Same title and type, ignoring case, punctuation and extra spaces ("Üç Renk: Mavi" ≈ "üç renk mavi").
 * Seasons of a series are told apart: "Lost" season 1 and season 2 aren't look-alikes.
 */
export function titleKey(mediaType: string, title: string, season?: number | null): string {
  const normalized = title
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return `${mediaType}|${normalized}${season ? `|s${season}` : ""}`;
}

/** What a list already holds, and where each match can be seen (an entry page, a row on the page). */
export type ExistingMedia = { keys: string[]; titles: string[]; links: Record<string, string> };

export function describeExisting(
  rows: readonly ({ id: string; source: string; externalId: string | null; mediaType: string; href?: string } & Titled)[],
): ExistingMedia {
  const keys = new Set<string>();
  const titles = new Set<string>();
  const links: Record<string, string> = {};
  for (const row of rows) {
    const own = [itemKey(row.id), ...(row.externalId ? [externalKey(row.source, row.externalId)] : [])];
    // Every name counts: "İz Sürücü" and "Stalker" are the same film.
    const names = allTitles(row).map((name) => titleKey(row.mediaType, name, row.seasonNumber));
    own.forEach((key) => keys.add(key));
    names.forEach((name) => titles.add(name));
    if (row.href) for (const key of [...own, ...names]) links[key] ??= row.href;
  }
  return { keys: [...keys], titles: [...titles], links };
}
