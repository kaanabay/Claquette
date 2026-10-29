import "server-only";
import { googleBooksProvider } from "./google-books";
import { itunesProvider } from "./itunes";
import { titleFold } from "./matching";
import { openLibraryProvider } from "./open-library";
import { tmdbProvider } from "./tmdb";
import type { MediaProvider, MediaSearchResult, PersonRef, PersonResult } from "./types";

export type { MediaDetails, MediaProvider, MediaSearchResult, PersonRef, PersonResult, SeasonOption } from "./types";

/** Order matters: results are listed provider by provider. */
export const PROVIDERS: readonly MediaProvider[] = [tmdbProvider, googleBooksProvider, openLibraryProvider, itunesProvider];

export function getProvider(id: string): MediaProvider | undefined {
  return PROVIDERS.find((provider) => provider.id === id);
}

export function providersFor(mediaType: string): MediaProvider[] {
  return PROVIDERS.filter((provider) => provider.mediaTypes.includes(mediaType) && provider.isConfigured());
}

/** Asks every configured provider; one failing source doesn't hide the others. */
async function gather<T>(providers: MediaProvider[], ask: (provider: MediaProvider) => Promise<T[]>, what: string) {
  const settled = await Promise.allSettled(providers.map(ask));
  const results: T[] = [];
  const failed: string[] = [];
  settled.forEach((outcome, i) => {
    if (outcome.status === "fulfilled") results.push(...outcome.value);
    else {
      failed.push(providers[i].label);
      console.warn(`[media] ${providers[i].id} ${what} failed:`, outcome.reason);
    }
  });
  return { results, failed };
}

/** Queries every configured provider in parallel. */
export function searchMedia(mediaType: string, query: string): Promise<{ results: MediaSearchResult[]; failed: string[] }> {
  return gather(providersFor(mediaType), (provider) => provider.search(query, mediaType), "search");
}

/** People whose name answers the query ("Tarkovski", "Bulgakov"), at most two. */
export async function searchPeople(mediaType: string, query: string): Promise<PersonResult[]> {
  const providers = providersFor(mediaType).filter((provider) => provider.searchPeople);
  const { results } = await gather(providers, (provider) => provider.searchPeople!(query, mediaType), "people search");
  return results.slice(0, 2);
}

/**
 * A person's works from every source that can list them: the person's own source by id, the
 * others by name (Google Books lists an Open Library author's Turkish editions). Within one
 * person's works the same title is the same work, so later sources only add new titles.
 */
export async function worksBy(person: PersonRef, mediaType: string): Promise<{ results: MediaSearchResult[]; failed: string[] }> {
  const providers = providersFor(mediaType).filter((provider) => provider.worksBy);
  const { results, failed } = await gather(providers, (provider) => provider.worksBy!(person, mediaType), "works");
  const seen = new Set<string>();
  return {
    results: results.filter((result) => {
      const key = titleFold(result.title);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
    failed,
  };
}
