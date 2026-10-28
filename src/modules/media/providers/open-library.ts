import { fetchJson, TTL, yearOf, type MediaProvider } from "./types";

// Open Library: open data, no key. Used next to Google Books (and as its fallback).
const BASE = "https://openlibrary.org";
const COVERS = "https://covers.openlibrary.org/b/id";
const headers = { "User-Agent": "Claquette/0.1 (media club app)" };

type SearchDoc = { key: string; title: string; author_name?: string[]; first_publish_year?: number; cover_i?: number };

type Work = {
  title?: string;
  description?: string | { value?: string };
  covers?: number[];
  subjects?: string[];
  first_publish_date?: string;
  authors?: { author?: { key?: string } }[];
};

export const openLibraryProvider: MediaProvider = {
  id: "open_library",
  label: "Open Library",
  mediaTypes: ["book"],

  isConfigured: () => true,

  async search(query) {
    const url = `${BASE}/search.json?q=${encodeURIComponent(query)}&limit=8&fields=key,title,author_name,first_publish_year,cover_i`;
    const data = await fetchJson<{ docs?: SearchDoc[] }>(url, { headers, next: { revalidate: TTL.search } });
    return (data.docs ?? []).map((doc) => ({
      provider: "open_library",
      providerLabel: "Open Library",
      externalId: doc.key.replace("/works/", ""),
      mediaType: "book",
      title: doc.title,
      originalTitle: null,
      year: doc.first_publish_year ?? null,
      creators: doc.author_name?.slice(0, 3) ?? [],
      // default=false → 404 instead of a blank placeholder, so the UI shows its own fallback.
      imageUrl: doc.cover_i ? `${COVERS}/${doc.cover_i}-M.jpg?default=false` : null,
    }));
  },

  async getDetails(externalId) {
    if (!/^OL\d+W$/.test(externalId)) return null;
    const work = await fetchJson<Work>(`${BASE}/works/${externalId}.json`, { headers, next: { revalidate: TTL.details } });

    const authorKeys = (work.authors ?? [])
      .map((entry) => entry.author?.key)
      .filter((key): key is string => Boolean(key))
      .slice(0, 3);
    const authors = await Promise.all(
      authorKeys.map((key) =>
        fetchJson<{ name?: string }>(`${BASE}${key}.json`, { headers, next: { revalidate: TTL.details } })
          .then((author) => author.name ?? null)
          .catch(() => null),
      ),
    );

    const description = typeof work.description === "string" ? work.description : work.description?.value;
    const coverId = work.covers?.find((id) => id > 0);
    return {
      mediaType: "book",
      title: work.title ?? "İsimsiz",
      originalTitle: null,
      year: yearOf(work.first_publish_date),
      creators: authors.filter((name): name is string => Boolean(name)),
      description: description?.trim() || null,
      imageUrl: coverId ? `${COVERS}/${coverId}-L.jpg?default=false` : null,
      externalId,
      externalUrl: `${BASE}/works/${externalId}`,
      metadata: { genres: work.subjects?.slice(0, 5) },
    };
  },
};
