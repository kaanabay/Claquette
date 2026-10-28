// How the app names a media item: the original title first, the Turkish one in parentheses
// ("Stalker (İz Sürücü)", "La dolce vita (Tatlı Hayat)"), and a season when it is one
// ("Lost · 2. Sezon"). Pure; used on the server and the client.

export type Titled = { title: string; originalTitle: string | null; internationalTitle?: string | null; seasonNumber?: number | null };

export const seasonLabel = (season: number) => `${season}. Sezon`;

// A letter outside the Latin script (digits, punctuation and symbols are fine): "Сталкер", "東京物語".
const OTHER_SCRIPT_LETTER = /(?![\p{Script=Latin}])\p{L}/u;
export const isLatinText = (text: string) => !OTHER_SCRIPT_LETTER.test(text);

const comparable = (text: string) => text.toLocaleLowerCase("tr-TR").replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * The name to lead with: the original title, or the international one when the original is
 * written in another script ("Stalker" rather than "Сталкер"). Items without either (most books:
 * the sources give one title) lead with their only title.
 */
export function leadTitle(media: Titled): string {
  const original = media.originalTitle?.trim();
  if (original && isLatinText(original)) return original;
  return media.internationalTitle?.trim() || original || media.title;
}

/** The lead name and, when it differs, the Turkish one: { lead: "Stalker", local: "İz Sürücü" }. */
export function splitTitle(media: Titled): { lead: string; local: string | null } {
  const lead = leadTitle(media);
  return { lead, local: comparable(lead) === comparable(media.title) ? null : media.title };
}

/** "Stalker (İz Sürücü)"; just "Persona" when both names are the same; "Lost · 2. Sezon" for a season. */
export function formatTitle(media: Titled): string {
  const { lead, local } = splitTitle(media);
  const name = local ? `${lead} (${local})` : lead;
  return media.seasonNumber ? `${name} · ${seasonLabel(media.seasonNumber)}` : name;
}

/** The original in its own script when the lead name is a stand-in for it ("Сталкер"). */
export function nativeTitle(media: Titled): string | null {
  const original = media.originalTitle?.trim();
  return original && !isLatinText(original) && original !== leadTitle(media) ? original : null;
}

/** Every name the item goes by (for duplicate warnings and filters). */
export function allTitles(media: Titled): string[] {
  return [...new Set([media.title, media.originalTitle, media.internationalTitle].filter((name): name is string => Boolean(name?.trim())))];
}
