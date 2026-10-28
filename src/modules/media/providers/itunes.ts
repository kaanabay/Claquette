import { fetchJson, TTL, yearOf, type MediaProvider } from "./types";

// iTunes Search API: keyless podcast directory.
const BASE = "https://itunes.apple.com";

type Podcast = {
  collectionId: number;
  collectionName: string;
  artistName?: string;
  artworkUrl600?: string;
  artworkUrl100?: string;
  releaseDate?: string;
  collectionViewUrl?: string;
  genres?: string[];
  trackCount?: number;
};

export const itunesProvider: MediaProvider = {
  id: "itunes",
  label: "Apple Podcasts",
  mediaTypes: ["podcast"],

  isConfigured: () => true,

  async search(query) {
    const url = `${BASE}/search?media=podcast&entity=podcast&limit=10&country=TR&term=${encodeURIComponent(query)}`;
    const data = await fetchJson<{ results?: Podcast[] }>(url, { next: { revalidate: TTL.search } });
    return (data.results ?? []).map((podcast) => ({
      provider: "itunes",
      providerLabel: "Apple Podcasts",
      externalId: String(podcast.collectionId),
      mediaType: "podcast",
      title: podcast.collectionName,
      originalTitle: null,
      year: yearOf(podcast.releaseDate),
      creators: podcast.artistName ? [podcast.artistName] : [],
      imageUrl: podcast.artworkUrl100 ?? null,
    }));
  },

  async getDetails(externalId) {
    if (!/^\d+$/.test(externalId)) return null;
    const data = await fetchJson<{ results?: Podcast[] }>(`${BASE}/lookup?id=${externalId}&entity=podcast`, {
      next: { revalidate: TTL.details },
    });
    const podcast = data.results?.[0];
    if (!podcast) return null;
    return {
      mediaType: "podcast",
      title: podcast.collectionName,
      originalTitle: null,
      year: yearOf(podcast.releaseDate),
      creators: podcast.artistName ? [podcast.artistName] : [],
      description: null,
      imageUrl: podcast.artworkUrl600 ?? podcast.artworkUrl100 ?? null,
      externalId,
      externalUrl: podcast.collectionViewUrl ?? null,
      metadata: { genres: podcast.genres?.filter((genre) => genre !== "Podcasts"), episodes: podcast.trackCount },
    };
  },
};
