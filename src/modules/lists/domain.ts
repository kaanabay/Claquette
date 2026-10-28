// Personal lists: pure rules (no I/O).

export const LIST_VISIBILITIES = ["private", "public"] as const;
export type ListVisibility = (typeof LIST_VISIBILITIES)[number];

export const MAX_LIST_ITEMS = 500;

/** Public lists are open to anyone with the link (even signed out); private ones to their owner only. */
export function canViewList(list: { ownerId: string; visibility: ListVisibility }, viewerId: string | null): boolean {
  return list.visibility === "public" || list.ownerId === viewerId;
}

/** A reorder request must name exactly the list's items, each once. */
export function isSameItemSet(current: readonly string[], requested: readonly string[]): boolean {
  if (current.length !== requested.length || new Set(requested).size !== requested.length) return false;
  const known = new Set(current);
  return requested.every((id) => known.has(id));
}

const NOUNS: Record<string, string> = { book: "kitap", movie: "film", tv: "dizi", podcast: "podcast", game: "oyun" };

/** "10 film", "3 kitap · 2 film"; mixed lists with many types simply count items. */
export function describeItemCounts(counts: readonly { mediaType: string; total: number }[]): string {
  const byNoun = new Map<string, number>();
  for (const { mediaType, total } of counts) {
    if (total <= 0) continue;
    const noun = NOUNS[mediaType] ?? "öge";
    byNoun.set(noun, (byNoun.get(noun) ?? 0) + total);
  }
  if (byNoun.size === 0) return "Henüz boş";
  const sum = [...byNoun.values()].reduce((a, b) => a + b, 0);
  if (byNoun.size > 3) return `${sum} öge`;
  return [...byNoun.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([noun, total]) => `${total} ${noun}`)
    .join(" · ");
}
