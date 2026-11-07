import { searchText, type FilterKey } from "@/lib/search-text";
import { formatTitle } from "@/modules/media/titles";
import type { SharedListSummary } from "./summaries";

/** How a page's search finds a shared list's card: its name, its group, and the items the card shows. */
export function summaryFilterKey(summary: Pick<SharedListSummary, "title" | "groupName" | "current" | "upcoming">): FilterKey {
  const items = [...(summary.current?.items ?? []), ...summary.upcoming.flatMap((slot) => slot.items)];
  return { text: searchText([summary.title, summary.groupName, ...items.flatMap((item) => [formatTitle(item), item.title, ...item.creators])]) };
}
