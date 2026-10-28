import "server-only";
import { googleBooksProvider } from "./google-books";
import { itunesProvider } from "./itunes";
import { openLibraryProvider } from "./open-library";
import { tmdbProvider } from "./tmdb";
import type { MediaProvider, MediaSearchResult } from "./types";

export type { MediaDetails, MediaProvider, MediaSearchResult, SeasonOption } from "./types";

/** Order matters: results are listed provider by provider. */
export const PROVIDERS: readonly MediaProvider[] = [tmdbProvider, googleBooksProvider, openLibraryProvider, itunesProvider];

export function getProvider(id: string): MediaProvider | undefined {
  return PROVIDERS.find((provider) => provider.id === id);
}

export function providersFor(mediaType: string): MediaProvider[] {
  return PROVIDERS.filter((provider) => provider.mediaTypes.includes(mediaType) && provider.isConfigured());
}

/** Queries every configured provider in parallel; one failing source doesn't hide the others. */
export async function searchMedia(
  mediaType: string,
  query: string,
): Promise<{ results: MediaSearchResult[]; failed: string[] }> {
  const providers = providersFor(mediaType);
  const settled = await Promise.allSettled(providers.map((provider) => provider.search(query, mediaType)));
  const results: MediaSearchResult[] = [];
  const failed: string[] = [];
  settled.forEach((outcome, i) => {
    if (outcome.status === "fulfilled") results.push(...outcome.value);
    else {
      failed.push(providers[i].label);
      console.warn(`[media] ${providers[i].id} search failed:`, outcome.reason);
    }
  });
  return { results, failed };
}
