import { isLatinText } from "../titles";
import { matchesPerson, titleFold } from "./matching";
import { fetchJson, TTL, yearOf, type MediaProvider, type MediaSearchResult, type PersonResult } from "./types";

// Open Library: open data, no key. Used next to Google Books (and as its fallback). A work is the
// book across languages ("Мастер и Маргарита"); asking for Turkish brings its Turkish edition
// along ("Usta ile Margarita"), whose title is what we show and store.
const BASE = "https://openlibrary.org";
const COVERS = "https://covers.openlibrary.org/b/id";
const headers = { "User-Agent": "Claquette/0.1 (media club app)" };
const FIELDS = "key,title,author_name,first_publish_year,cover_i,editions,editions.key,editions.title,editions.language";

type EditionDoc = { key?: string; title?: string; language?: string[] };
type SearchDoc = {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  editions?: { docs?: EditionDoc[] };
};

type Work = {
  title?: string;
  description?: string | { value?: string };
  covers?: number[];
  subjects?: string[];
  first_publish_date?: string;
  authors?: { author?: { key?: string } }[];
};

type Edition = { title?: string; subtitle?: string; covers?: number[] };

type AuthorDoc = { key: string; name: string; alternate_names?: string[]; work_count?: number };

/** "OL676009W", or a work with the Turkish edition to name it by: "OL676009W:OL26461504M". */
export function parseOpenLibraryId(externalId: string): { work: string; edition: string | null } | null {
  const match = externalId.match(/^(OL\d+W)(?::(OL\d+M))?$/);
  return match ? { work: match[1], edition: match[2] ?? null } : null;
}

/**
 * Names a search hit: by its Turkish edition when there is one, otherwise by the work's title in
 * Latin script (the edition's, when the work's isn't). A Latin original different from the
 * Turkish title stays as the original: "The Hobbit (Hobbit)".
 */
export function openLibraryResult(doc: SearchDoc): MediaSearchResult {
  const workId = doc.key.replace("/works/", "");
  const edition = doc.editions?.docs?.[0];
  const editionId = edition?.key?.replace("/books/", "") ?? null;
  const turkish = Boolean(edition?.title && edition.language?.includes("tur") && editionId);
  const title = turkish
    ? edition!.title!
    : isLatinText(doc.title) || !edition?.title || !isLatinText(edition.title)
      ? doc.title
      : edition.title;
  const original = turkish && isLatinText(doc.title) && titleFold(doc.title) !== titleFold(title) ? doc.title : null;
  return {
    provider: "open_library",
    providerLabel: "Open Library",
    externalId: turkish ? `${workId}:${editionId}` : workId,
    mediaType: "book",
    title,
    originalTitle: original,
    year: doc.first_publish_year ?? null,
    creators: (doc.author_name ?? []).filter(isLatinText).slice(0, 3),
    // default=false → 404 instead of a blank placeholder, so the UI shows its own fallback.
    imageUrl: doc.cover_i ? `${COVERS}/${doc.cover_i}-M.jpg?default=false` : null,
  };
}

async function searchWorks(params: string, limit: number): Promise<MediaSearchResult[]> {
  const url = `${BASE}/search.json?${params}&lang=tr&limit=${limit}&fields=${FIELDS}`;
  const data = await fetchJson<{ docs?: SearchDoc[] }>(url, { headers, next: { revalidate: TTL.search } });
  return (data.docs ?? []).map(openLibraryResult);
}

/** An author's name in Latin script ("Mikhail Bulgakov" for "Михаил Булгаков"). */
const latinName = (author: AuthorDoc) =>
  isLatinText(author.name) ? author.name : (author.alternate_names?.find(isLatinText) ?? author.name);

export const openLibraryProvider: MediaProvider = {
  id: "open_library",
  label: "Open Library",
  mediaTypes: ["book"],

  isConfigured: () => true,

  search(query) {
    return searchWorks(`q=${encodeURIComponent(query)}`, 8);
  },

  async searchPeople(query) {
    const url = `${BASE}/search/authors.json?q=${encodeURIComponent(query)}&limit=6&fields=key,name,alternate_names,work_count`;
    const data = await fetchJson<{ docs?: AuthorDoc[] }>(url, { headers, next: { revalidate: TTL.search } });
    return (data.docs ?? [])
      .filter((author) => matchesPerson(query, [author.name, ...(author.alternate_names ?? [])]))
      .sort((a, b) => (b.work_count ?? 0) - (a.work_count ?? 0))
      .slice(0, 2)
      .map(
        (author): PersonResult => ({
          provider: "open_library",
          id: author.key,
          name: latinName(author),
          kind: "author",
          detail: author.work_count ? `${author.work_count} eser` : null,
          imageUrl: `https://covers.openlibrary.org/a/olid/${author.key}-M.jpg?default=false`,
        }),
      );
  },

  worksBy(person) {
    const byAuthor =
      person.provider === "open_library" && /^OL\d+A$/.test(person.id)
        ? `author_key=${person.id}`
        : `author=${encodeURIComponent(person.name)}`;
    // Most editions first: the books people know.
    return searchWorks(`${byAuthor}&sort=editions`, 20);
  },

  async getDetails(externalId) {
    const parsed = parseOpenLibraryId(externalId);
    if (!parsed) return null;
    const [work, edition] = await Promise.all([
      fetchJson<Work>(`${BASE}/works/${parsed.work}.json`, { headers, next: { revalidate: TTL.details } }),
      parsed.edition
        ? fetchJson<Edition>(`${BASE}/books/${parsed.edition}.json`, { headers, next: { revalidate: TTL.details } }).catch(() => null)
        : Promise.resolve(null),
    ]);

    const authorKeys = (work.authors ?? [])
      .map((entry) => entry.author?.key)
      .filter((key): key is string => Boolean(key))
      .slice(0, 3);
    const authors = await Promise.all(
      authorKeys.map((key) =>
        fetchJson<AuthorDoc>(`${BASE}${key}.json`, { headers, next: { revalidate: TTL.details } })
          .then((author) => (author.name ? latinName(author) : null))
          .catch(() => null),
      ),
    );

    const workTitle = work.title ?? "İsimsiz";
    const title = edition?.title ? [edition.title, edition.subtitle].filter(Boolean).join(": ") : workTitle;
    const description = typeof work.description === "string" ? work.description : work.description?.value;
    const coverId = edition?.covers?.find((id) => id > 0) ?? work.covers?.find((id) => id > 0);
    return {
      mediaType: "book",
      title,
      originalTitle: edition?.title && isLatinText(workTitle) && titleFold(workTitle) !== titleFold(title) ? workTitle : null,
      year: yearOf(work.first_publish_date),
      creators: authors.filter((name): name is string => Boolean(name)),
      description: description?.trim() || null,
      imageUrl: coverId ? `${COVERS}/${coverId}-L.jpg?default=false` : null,
      externalId,
      externalUrl: `${BASE}/works/${parsed.work}`,
      metadata: { genres: work.subjects?.slice(0, 5) },
    };
  },
};
