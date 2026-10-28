// Sorting what a list holds: by date (a "watched" diary), by name or by year. Pure; the same on
// the server and the client.
import { leadTitle, type Titled } from "./titles";

export const SORTS = ["manual", "newest", "oldest", "title", "year"] as const;
export type SortKey = (typeof SORTS)[number];

export const SORT_LABELS: Record<SortKey, string> = {
  manual: "Elle (sürükle-bırak)",
  newest: "Tarih: yeniden eskiye",
  oldest: "Tarih: eskiden yeniye",
  title: "Başlık (A–Z)",
  year: "Yıl: yeniden eskiye",
};

export const isSortKey = (value: unknown): value is SortKey => SORTS.includes(value as SortKey);

export type SortFields = { addedAt: Date; media: Titled & { year: number | null } };

const collator = new Intl.Collator("tr", { sensitivity: "base", numeric: true });

const COMPARE: Record<Exclude<SortKey, "manual">, (a: SortFields, b: SortFields) => number> = {
  newest: (a, b) => b.addedAt.getTime() - a.addedAt.getTime(),
  oldest: (a, b) => a.addedAt.getTime() - b.addedAt.getTime(),
  // By the name shown first ("Stalker", not "İz Sürücü"); seasons of a series in order.
  title: (a, b) => collator.compare(leadTitle(a.media), leadTitle(b.media)) || (a.media.seasonNumber ?? 0) - (b.media.seasonNumber ?? 0),
  // Items without a year go last.
  year: (a, b) => (b.media.year ?? -1) - (a.media.year ?? -1),
};

/** Sorts rows by `sort`; ties, and "manual", keep the order they come in (a list's own order). */
export function sortRows<T>(rows: readonly T[], sort: SortKey, fields: (row: T) => SortFields): T[] {
  if (sort === "manual") return [...rows];
  const compare = COMPARE[sort];
  return rows
    .map((row, index) => ({ row, index, fields: fields(row) }))
    .sort((a, b) => compare(a.fields, b.fields) || a.index - b.index)
    .map((entry) => entry.row);
}
