import { searchText, type FilterKey } from "@/lib/search-text";
import { formatTitle, type Titled } from "./titles";

type Searchable = Titled & { mediaType: string; creators: readonly string[]; year: number | null };

/**
 * How a page's search and type filter find a media item: by its type, its names (as shown, Turkish,
 * original, international), its people and year, and anything `more` (who added it).
 */
export function mediaFilterKey(media: Searchable, more: readonly (string | null | undefined)[] = []): FilterKey {
  return {
    type: media.mediaType,
    text: searchText([
      formatTitle(media),
      media.title,
      media.originalTitle,
      media.internationalTitle,
      ...media.creators,
      media.year,
      ...more,
    ]),
  };
}
