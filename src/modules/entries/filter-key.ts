import type { FilterKey } from "@/lib/search-text";
import { mediaFilterKey } from "@/modules/media/filter-key";
import type { EntryCard } from "./queries";

/**
 * How a page's search and type filter find an entry card: its media and who added it, and where the
 * card names its list (the home page) the list too.
 */
export const entryFilterKey = (card: Pick<EntryCard, "media" | "suggestedBy" | "challengeTitle">, withList = false): FilterKey =>
  mediaFilterKey(card.media, [card.suggestedBy?.name, withList ? card.challengeTitle : null]);
