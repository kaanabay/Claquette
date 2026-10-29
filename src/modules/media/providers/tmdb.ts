import { isLatinText } from "../titles";
import { matchesPerson } from "./matching";
import {
  fetchJson,
  TTL,
  yearOf,
  type MediaDetails,
  type MediaProvider,
  type MediaSearchResult,
  type PersonKind,
  type PersonResult,
  type SeasonOption,
} from "./types";

// The Movie Database: free for non-commercial use with attribution (see the app footer).
const API = "https://api.themoviedb.org/3";
const IMAGE = "https://image.tmdb.org/t/p";

type Kind = "movie" | "tv";
const kindOf = (mediaType: string): Kind => (mediaType === "tv" ? "tv" : "movie");

type SearchItem = {
  id: number;
  popularity?: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
};

type Person = { id: number; name: string };

type SeasonSummary = { season_number: number; air_date?: string | null; episode_count?: number; poster_path?: string | null };

type Details = SearchItem & {
  overview?: string;
  runtime?: number | null;
  number_of_seasons?: number;
  number_of_episodes?: number;
  genres?: { name: string }[];
  original_language?: string;
  created_by?: Person[];
  credits?: { crew?: (Person & { job: string })[] };
  seasons?: SeasonSummary[];
};

type SeasonDetails = SeasonSummary & { overview?: string; episodes?: unknown[] };

type PersonItem = {
  id: number;
  name: string;
  popularity?: number;
  known_for_department?: string;
  profile_path?: string | null;
  known_for?: SearchItem[];
};
type Credit = SearchItem & { job?: string; department?: string };
type Credits = { cast?: Credit[]; crew?: Credit[] };

const KINDS: Record<string, PersonKind> = { Directing: "director", Writing: "writer", Acting: "actor" };

/**
 * A person's films or series for what they are known for (a director's directing, an actor's
 * roles), oldest first: the filmography to pick a month's film from.
 */
export function creditsFor(kind: PersonKind, credits: Credits): Credit[] {
  const crew = credits.crew ?? [];
  const chosen =
    kind === "actor"
      ? (credits.cast ?? [])
      : kind === "director"
        ? crew.filter((credit) => credit.job === "Director" || credit.job === "Creator")
        : kind === "writer"
          ? crew.filter((credit) => credit.department === "Writing")
          : [...crew, ...(credits.cast ?? [])];
  const unique = [...new Map(chosen.map((credit) => [credit.id, credit])).values()];
  const dateOf = (credit: Credit) => credit.release_date || credit.first_air_date || "9999";
  return unique.sort((a, b) => dateOf(a).localeCompare(dateOf(b)));
}

/** "movie:1398", "tv:4607", or a season of a series: "tv:4607:s2". */
export function parseTmdbId(externalId: string): { kind: Kind; id: string; season: number | null } | null {
  const match = externalId.match(/^(movie|tv):(\d+)(?::s(\d+))?$/);
  if (!match || (match[3] && match[1] !== "tv")) return null;
  const season = match[3] ? Number(match[3]) : null;
  if (season === 0) return null;
  return { kind: match[1] as Kind, id: match[2], season };
}

/** Directors of a film, creators of a series. */
const creatorsOf = (kind: Kind, data: Details): Person[] =>
  kind === "movie" ? (data.credits?.crew ?? []).filter((member) => member.job === "Director") : (data.created_by ?? []);

/**
 * The English title stands in for an original written in another script ("Stalker" for
 * "Сталкер", "Tokyo Story" for "東京物語"); Latin originals need no stand-in.
 */
export function internationalTitleOf(original: string | null, english: string | null | undefined): string | null {
  if (!original || isLatinText(original) || !english || !isLatinText(english) || english === original) return null;
  return english;
}

function request<T>(path: string, params: Record<string, string>, revalidate: number): Promise<T> {
  const key = process.env.TMDB_API_KEY ?? "";
  const url = new URL(API + path);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const headers: Record<string, string> = { accept: "application/json" };
  // Accept both credential types TMDB hands out: the v4 read token (a JWT) or the v3 key.
  if (key.startsWith("eyJ")) headers.authorization = `Bearer ${key}`;
  else url.searchParams.set("api_key", key);
  return fetchJson<T>(url.toString(), { headers, next: { revalidate } });
}

const poster = (path: string | null | undefined, size: "w185" | "w500") => (path ? `${IMAGE}/${size}${path}` : null);

/**
 * "Stalker 1979" → search "Stalker" in that year. Numbers past the near future stay part of the
 * title ("Blade Runner 2049"); titles like "Wonder Woman 1984" fall back to a plain search.
 */
export function splitTitleYear(query: string, maxYear = new Date().getFullYear() + 3): { title: string; year: string | null } {
  const match = query.trim().match(/^(.*\S)\s+\(?((?:18|19|20)\d{2})\)?$/);
  return match && Number(match[2]) <= maxYear ? { title: match[1], year: match[2] } : { title: query.trim(), year: null };
}

/**
 * Turkish results first, with English ones merged in: people often type a film's English title,
 * and Tarkovsky's "Stalker" is "İz Sürücü" in Turkish, so a Turkish-only search misses it.
 * An item keeps its best position in either list (Turkish wins ties) and its Turkish title if known.
 */
export function mergeSearchResults<T extends { id: number; popularity?: number }>(turkish: readonly T[], english: readonly T[], limit: number): T[] {
  const ranked = new Map<number, { item: T; score: number }>();
  turkish.forEach((item, i) => ranked.set(item.id, { item, score: i }));
  english.forEach((item, i) => {
    const existing = ranked.get(item.id);
    if (existing) existing.score = Math.min(existing.score, i + 0.5);
    else ranked.set(item.id, { item, score: i + 0.5 });
  });
  return [...ranked.values()]
    .sort((a, b) => a.score - b.score || (b.item.popularity ?? 0) - (a.item.popularity ?? 0))
    .slice(0, limit)
    .map((entry) => entry.item);
}

function toResult(kind: Kind, item: SearchItem, englishTitles: ReadonlyMap<number, string | undefined>): MediaSearchResult {
  const originalTitle = item.original_title ?? item.original_name ?? null;
  return {
    provider: "tmdb",
    providerLabel: "TMDB",
    externalId: `${kind}:${item.id}`,
    mediaType: kind,
    title: item.title ?? item.name ?? "İsimsiz",
    originalTitle,
    internationalTitle: internationalTitleOf(originalTitle, englishTitles.get(item.id)),
    year: yearOf(item.release_date ?? item.first_air_date),
    creators: [],
    imageUrl: poster(item.poster_path, "w185"),
    hasSeasons: kind === "tv",
  };
}

export const tmdbProvider: MediaProvider = {
  id: "tmdb",
  label: "TMDB",
  mediaTypes: ["movie", "tv"],

  isConfigured: () => Boolean(process.env.TMDB_API_KEY),

  async search(query, mediaType) {
    const kind = kindOf(mediaType);
    const find = async (text: string, year: string | null) => {
      const params: Record<string, string> = { query: text, include_adult: "false" };
      if (year) params[kind === "movie" ? "year" : "first_air_date_year"] = year;
      const [turkish, english] = await Promise.all(
        (["tr-TR", "en-US"] as const).map((language) =>
          request<{ results: SearchItem[] }>(`/search/${kind}`, { ...params, language }, TTL.search),
        ),
      );
      const englishTitles = new Map(english.results.map((item) => [item.id, item.title ?? item.name]));
      return { items: mergeSearchResults(turkish.results, english.results, 10), englishTitles };
    };
    const { title, year } = splitTitleYear(query);
    let found = year ? await find(title, year) : null;
    if (!found || found.items.length === 0) found = await find(query.trim(), null);
    return found.items.map((item) => toResult(kind, item, found.englishTitles));
  },

  // Names in English (in Turkish they come back in their own script: "Андрей Тарковский"), the
  // titles they are known for in Turkish. The best known of the matching people first.
  async searchPeople(query) {
    const [english, turkish] = await Promise.all(
      (["en-US", "tr-TR"] as const).map((language) =>
        request<{ results: PersonItem[] }>("/search/person", { query, include_adult: "false", language }, TTL.search),
      ),
    );
    const knownFor = new Map(turkish.results.map((person) => [person.id, person.known_for ?? []]));
    return english.results
      .filter((person) => matchesPerson(query, [person.name]))
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, 2)
      .map(
        (person): PersonResult => ({
          provider: "tmdb",
          id: String(person.id),
          name: person.name,
          kind: KINDS[person.known_for_department ?? ""] ?? "person",
          detail:
            (knownFor.get(person.id) ?? person.known_for ?? [])
              .map((work) => work.title ?? work.name)
              .filter(Boolean)
              .slice(0, 3)
              .join(", ") || null,
          imageUrl: poster(person.profile_path, "w185"),
        }),
      );
  },

  async worksBy(person, mediaType) {
    if (person.provider !== "tmdb" || !/^\d+$/.test(person.id)) return [];
    const kind = kindOf(mediaType);
    const [turkish, english] = await Promise.all(
      (["tr-TR", "en-US"] as const).map((language) => request<Credits>(`/person/${person.id}/${kind}_credits`, { language }, TTL.details)),
    );
    const englishTitles = new Map([...(english.cast ?? []), ...(english.crew ?? [])].map((credit) => [credit.id, credit.title ?? credit.name]));
    return creditsFor(person.kind, turkish)
      .slice(0, 60)
      .map((credit) => toResult(kind, credit, englishTitles));
  },

  async getSeasons(externalId) {
    const parsed = parseTmdbId(externalId);
    if (!parsed || parsed.kind !== "tv" || parsed.season !== null) return [];
    // Same request as getDetails, so picking a season afterwards hits the cache.
    const data = await request<Details>(`/tv/${parsed.id}`, { language: "tr-TR", append_to_response: "credits" }, TTL.details);
    return (data.seasons ?? [])
      .filter((season) => season.season_number > 0) // 0 = specials
      .map(
        (season): SeasonOption => ({
          externalId: `tv:${parsed.id}:s${season.season_number}`,
          seasonNumber: season.season_number,
          year: yearOf(season.air_date ?? undefined),
          episodes: season.episode_count ?? null,
          imageUrl: poster(season.poster_path, "w185"),
        }),
      );
  },

  async getDetails(externalId) {
    const parsed = parseTmdbId(externalId);
    if (!parsed) return null;
    const { kind, id, season } = parsed;

    const [data, seasonData] = await Promise.all([
      request<Details>(`/${kind}/${id}`, { language: "tr-TR", append_to_response: "credits" }, TTL.details),
      season !== null ? request<SeasonDetails>(`/tv/${id}/season/${season}`, { language: "tr-TR" }, TTL.details) : null,
    ]);
    let overview = data.overview?.trim();
    let people = creatorsOf(kind, data);
    const originalTitle = data.original_title ?? data.original_name ?? null;
    let internationalTitle: string | null = null;
    // From the English data: a synopsis many titles lack in Turkish, names of people who have no
    // Turkish one (they come back in their own script), and a Latin title for originals that aren't.
    if (!overview || !people.every((person) => isLatinText(person.name)) || (originalTitle && !isLatinText(originalTitle))) {
      const english = await request<Details>(`/${kind}/${id}`, { language: "en-US", append_to_response: "credits" }, TTL.details);
      overview ||= english.overview?.trim();
      const englishNames = new Map(creatorsOf(kind, english).map((person) => [person.id, person.name]));
      people = people.map((person) => (isLatinText(person.name) ? person : { ...person, name: englishNames.get(person.id) ?? person.name }));
      internationalTitle = internationalTitleOf(originalTitle, english.title ?? english.name);
    }
    const creators = people.map((person) => person.name);

    // A season keeps the series' names and people, with its own year, poster, synopsis and episodes.
    const episodes = seasonData ? (seasonData.episodes?.length ?? seasonData.episode_count) : data.number_of_episodes;
    const details: MediaDetails = {
      mediaType: kind,
      title: data.title ?? data.name ?? "İsimsiz",
      originalTitle,
      internationalTitle,
      seasonNumber: season,
      year: yearOf(seasonData?.air_date ?? undefined) ?? yearOf(data.release_date ?? data.first_air_date),
      creators: [...new Set(creators)],
      description: seasonData?.overview?.trim() || overview || null,
      imageUrl: poster(seasonData?.poster_path ?? data.poster_path, "w500"),
      externalId,
      externalUrl: `https://www.themoviedb.org/${kind}/${id}${season !== null ? `/season/${season}` : ""}`,
      metadata: {
        genres: data.genres?.map((genre) => genre.name),
        language: data.original_language,
        ...(data.runtime ? { runtimeMinutes: data.runtime } : {}),
        ...(season === null && data.number_of_seasons ? { seasons: data.number_of_seasons } : {}),
        ...(episodes ? { episodes } : {}),
      },
    };
    return details;
  },
};
