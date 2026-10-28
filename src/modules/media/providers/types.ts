import type { MediaMetadata } from "@/db/schema";

/** A row in the search dropdown. */
export type MediaSearchResult = {
  provider: string;
  providerLabel: string;
  externalId: string;
  mediaType: string;
  title: string;
  originalTitle: string | null;
  /** Latin-script title when the original uses another script ("Stalker" for "Сталкер"). */
  internationalTitle?: string | null;
  year: number | null;
  creators: string[];
  imageUrl: string | null;
  /** A series whose seasons can be added one by one (see MediaProvider.getSeasons). */
  hasSeasons?: boolean;
};

/** One season of a series, pickable on its own: "Lost · 2. Sezon". */
export type SeasonOption = {
  externalId: string;
  seasonNumber: number;
  year: number | null;
  episodes: number | null;
  imageUrl: string | null;
};

/** Everything we store in media_items, normalized across providers. */
export type MediaDetails = {
  mediaType: string;
  title: string;
  originalTitle: string | null;
  internationalTitle?: string | null;
  seasonNumber?: number | null;
  year: number | null;
  creators: string[];
  description: string | null;
  imageUrl: string | null;
  externalId: string;
  externalUrl: string | null;
  metadata: MediaMetadata;
};

// Adapter contract. A new source (RAWG for games, AniList for anime, MusicBrainz...) is
// one file implementing this interface plus one entry in ./index.ts.
export interface MediaProvider {
  readonly id: string;
  readonly label: string;
  readonly mediaTypes: readonly string[];
  /** False when a required API key is missing; the provider is then skipped. */
  isConfigured(): boolean;
  search(query: string, mediaType: string): Promise<MediaSearchResult[]>;
  getDetails(externalId: string, mediaType: string): Promise<MediaDetails | null>;
  /** The seasons of a series result, when the source knows them. */
  getSeasons?(externalId: string): Promise<SeasonOption[]>;
}

const SEARCH_TTL = 60 * 60 * 24; // provider responses are cached by Next.js' fetch cache
const DETAILS_TTL = 60 * 60 * 24 * 7;
export const TTL = { search: SEARCH_TTL, details: DETAILS_TTL } as const;

// Brief server-side hiccups (Google Books answers 503 now and then) are worth a quick second try;
// timeouts and 4xx (bad key, quota) are not. Next.js caches only 200 responses, so retries go out.
const RETRYABLE = new Set([500, 502, 503, 504]);
const RETRY_DELAYS_MS = [300, 900];

export async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) });
    if (response.ok) return (await response.json()) as T;
    const delay = RETRY_DELAYS_MS[attempt];
    if (delay === undefined || !RETRYABLE.has(response.status)) {
      throw new Error(`${new URL(url).host} responded ${response.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

export function yearOf(value?: string | number | null): number | null {
  const match = String(value ?? "").match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

export function httpsUrl(url?: string | null): string | null {
  return url ? url.replace(/^http:\/\//, "https://") : null;
}

export function plainText(html?: string | null): string | null {
  if (!html) return null;
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}
