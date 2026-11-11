// "İzledim" on a personal list, as pure rules. A mark belongs to the person and the catalog item, not
// to the list: the film shows as watched in every list of theirs that holds it, and stays on their
// profile after it leaves the list. The shared lists keep their own progress (entry_progress); both
// count as finished, and a page that says "finished" reads both.

/** How the "İzledim" dialog starts on a list: as the owner chose last time there, if they asked to remember. */
export function finishDefaults(remembered: boolean | null): { remove: boolean; remember: boolean } {
  return { remove: remembered === true, remember: remembered !== null };
}

/** What a list remembers after a mark: the choice when asked to, nothing (null) otherwise. */
export const rememberedChoice = (remove: boolean, remember: boolean): boolean | null => (remember ? remove : null);

// Where a finished item goes, as the notice says it.
const COLLECTION: Record<string, string> = {
  book: "okuduklarına",
  movie: "izlediklerine",
  tv: "izlediklerine",
  podcast: "dinlediklerine",
  game: "oynadıklarına",
};

/** "“Stalker” izlediklerine eklendi." (and "ve listeden çıkarıldı" when it left the list). */
export function finishedNotice(title: string, mediaType: string, removed: boolean): string {
  return `“${title}” ${COLLECTION[mediaType] ?? "bitirdiklerine"} eklendi${removed ? " ve listeden çıkarıldı" : ""}.`;
}

/** A finished item as its row shows it: the person's own mark (theirs to change) or a shared list's. */
export type ItemFinish = { finishedAt: Date; marked: boolean; entryId: string | null; challengeTitle: string | null };

type SharedFinish = { entryId: string; challengeTitle: string; finishedAt: Date };

/** The person's mark wins (it is the one they can change); else the shared list where they finished it last. */
export function itemFinish(mark: { finishedAt: Date } | undefined, shared: readonly SharedFinish[]): ItemFinish | null {
  const latest = shared.reduce<SharedFinish | null>((best, row) => (best && best.finishedAt >= row.finishedAt ? best : row), null);
  if (mark) return { finishedAt: mark.finishedAt, marked: true, entryId: latest?.entryId ?? null, challengeTitle: latest?.challengeTitle ?? null };
  return latest ? { finishedAt: latest.finishedAt, marked: false, entryId: latest.entryId, challengeTitle: latest.challengeTitle } : null;
}

/** One row per catalog item, its latest finish, newest first: watching something again moves it up. */
export function latestFinishes<T extends { mediaItemId: string; finishedAt: Date }>(rows: readonly T[]): T[] {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const known = latest.get(row.mediaItemId);
    if (!known || row.finishedAt > known.finishedAt) latest.set(row.mediaItemId, row);
  }
  return [...latest.values()].sort((a, b) => b.finishedAt.getTime() - a.finishedAt.getTime());
}

/**
 * Whether a mark shows to someone else (on a profile): only one made on a list that is public now.
 * A mark from a private list, or from one deleted since, is the person's alone.
 */
export const markIsVisible = (viewerIsOwner: boolean, listVisibility: "private" | "public" | null): boolean =>
  viewerIsOwner || listVisibility === "public";
