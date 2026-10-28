// Shapes shared by server queries and client components (no server-only imports here).
import { allTitles, formatTitle } from "./titles";

/** How many items one submit may add. */
export const MAX_BATCH = 20;

export type MediaTypeOption = {
  slug: string;
  label: string;
  icon: string;
  creatorLabel: string;
  /** Labels of configured providers; empty = manual entry only. */
  sources: string[];
};

/** An item already in the catalog, e.g. from one of the user's lists. */
export type CatalogPick = {
  mediaItemId: string;
  mediaType: string;
  title: string;
  originalTitle: string | null;
  internationalTitle: string | null;
  seasonNumber: number | null;
  year: number | null;
  creators: string[];
  imageUrl: string | null;
  icon: string;
  listTitle: string | null;
};

/**
 * An item picked in MediaPicker, waiting to be added. `label` is its full name ("Stalker
 * (İz Sürücü)"), `names` every name it goes by; `fields` is what the server reads (media/input.ts).
 */
export type PickedItem = {
  key: string;
  label: string;
  names: string[];
  seasonNumber: number | null;
  meta: string;
  imageUrl: string | null;
  icon: string;
  mediaType: string;
  fields: { source: "external"; provider: string; externalId: string } | { source: "catalog"; mediaItemId: string };
};

export function pickFromCatalog(pick: CatalogPick): PickedItem {
  return {
    key: `item:${pick.mediaItemId}`,
    label: formatTitle(pick),
    names: allTitles(pick),
    seasonNumber: pick.seasonNumber,
    meta: [pick.year, pick.creators.slice(0, 2).join(", ")].filter(Boolean).join(" · "),
    imageUrl: pick.imageUrl,
    icon: pick.icon,
    mediaType: pick.mediaType,
    fields: { source: "catalog", mediaItemId: pick.mediaItemId },
  };
}
