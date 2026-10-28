import { fetchJson, httpsUrl, plainText, TTL, yearOf, type MediaProvider } from "./types";

// Google Books: good coverage of Turkish editions. Works without a key, but the anonymous
// quota is shared per IP (and Vercel IPs are shared), so GOOGLE_BOOKS_API_KEY is recommended.
const API = "https://www.googleapis.com/books/v1/volumes";

type Volume = {
  id: string;
  volumeInfo: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publishedDate?: string;
    description?: string;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    pageCount?: number;
    categories?: string[];
    publisher?: string;
    language?: string;
    industryIdentifiers?: { type: string; identifier: string }[];
    canonicalVolumeLink?: string;
    infoLink?: string;
  };
};

function withKey(url: string): string {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  return key ? `${url}${url.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}` : url;
}

const cover = (volume: Volume) =>
  httpsUrl(volume.volumeInfo.imageLinks?.thumbnail ?? volume.volumeInfo.imageLinks?.smallThumbnail)?.replace(
    "&edge=curl",
    "",
  ) ?? null;

const fullTitle = (volume: Volume) =>
  [volume.volumeInfo.title ?? "İsimsiz", volume.volumeInfo.subtitle].filter(Boolean).join(": ");

export const googleBooksProvider: MediaProvider = {
  id: "google_books",
  label: "Google Books",
  mediaTypes: ["book"],

  isConfigured: () => true,

  async search(query) {
    const url = withKey(`${API}?q=${encodeURIComponent(query)}&maxResults=10&printType=books`);
    const data = await fetchJson<{ items?: Volume[] }>(url, { next: { revalidate: TTL.search } });
    return (data.items ?? []).map((volume) => ({
      provider: "google_books",
      providerLabel: "Google Books",
      externalId: volume.id,
      mediaType: "book",
      title: fullTitle(volume),
      originalTitle: null,
      year: yearOf(volume.volumeInfo.publishedDate),
      creators: volume.volumeInfo.authors ?? [],
      imageUrl: cover(volume),
    }));
  },

  async getDetails(externalId) {
    if (!/^[\w-]+$/.test(externalId)) return null;
    const volume = await fetchJson<Volume>(withKey(`${API}/${externalId}`), { next: { revalidate: TTL.details } });
    const info = volume.volumeInfo;
    const isbn =
      info.industryIdentifiers?.find((id) => id.type === "ISBN_13") ??
      info.industryIdentifiers?.find((id) => id.type === "ISBN_10");
    return {
      mediaType: "book",
      title: fullTitle(volume),
      originalTitle: null,
      year: yearOf(info.publishedDate),
      creators: info.authors ?? [],
      description: plainText(info.description),
      imageUrl: cover(volume),
      externalId,
      externalUrl: info.canonicalVolumeLink ?? info.infoLink ?? null,
      metadata: {
        pageCount: info.pageCount,
        genres: info.categories,
        publisher: info.publisher,
        language: info.language,
        isbn: isbn?.identifier,
      },
    };
  },
};
