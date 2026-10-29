import { collapseEditions } from "./matching";
import { fetchJson, httpsUrl, PATIENT_RETRIES, plainText, TTL, yearOf, type MediaProvider, type MediaSearchResult } from "./types";

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

/** One row per book (Turkish editions first, the others folded into it), at most `limit`. */
function toResults(volumes: readonly Volume[], limit: number): MediaSearchResult[] {
  const editions = volumes.map((volume) => ({
    volume,
    title: fullTitle(volume),
    authors: volume.volumeInfo.authors ?? [],
    turkish: volume.volumeInfo.language === "tr",
    hasCover: cover(volume) !== null,
  }));
  return collapseEditions(editions)
    .slice(0, limit)
    .map(({ item, editions: count }) => ({
      provider: "google_books",
      providerLabel: "Google Books",
      externalId: item.volume.id,
      mediaType: "book",
      title: item.title,
      originalTitle: null,
      year: yearOf(item.volume.volumeInfo.publishedDate),
      creators: item.authors,
      imageUrl: cover(item.volume),
      editions: count,
    }));
}

async function findVolumes(query: string): Promise<Volume[]> {
  // More results than shown: folding editions makes room.
  const url = withKey(`${API}?q=${encodeURIComponent(query)}&maxResults=20&printType=books`);
  const data = await fetchJson<{ items?: Volume[] }>(url, { next: { revalidate: TTL.search } }, PATIENT_RETRIES);
  return data.items ?? [];
}

export const googleBooksProvider: MediaProvider = {
  id: "google_books",
  label: "Google Books",
  mediaTypes: ["book"],

  isConfigured: () => true,

  async search(query) {
    return toResults(await findVolumes(query), 10);
  },

  // Any source's author, by name: Google Books knows the Turkish editions best.
  async worksBy(person) {
    const name = person.name.replace(/"/g, "");
    return toResults(await findVolumes(`inauthor:"${name}"`), 20);
  },

  async getDetails(externalId) {
    if (!/^[\w-]+$/.test(externalId)) return null;
    const volume = await fetchJson<Volume>(withKey(`${API}/${externalId}`), { next: { revalidate: TTL.details } }, PATIENT_RETRIES);
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
