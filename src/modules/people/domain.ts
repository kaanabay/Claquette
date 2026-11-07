// Profiles (pure, no I/O). There is no friend list: people know each other through the groups they
// share. A profile shows only what the viewer could already see on those groups' pages, gathered in
// one place: what the person did there, what they are on now, and their public personal lists.

/** Who may open someone's profile: themselves, anyone who shares a group with them, and the site admin. */
export function canViewProfile(input: { viewerId: string; personId: string; sharedGroups: number; viewerIsSiteAdmin: boolean }): boolean {
  return input.viewerId === input.personId || input.sharedGroups > 0 || input.viewerIsSiteAdmin;
}

/** Kinds of things a person does, for filtering their history. */
export const ACTIVITY_KINDS = [
  { slug: "added", label: "Ekledi" },
  { slug: "finished", label: "Bitirdi" },
  { slug: "rated", label: "Puan verdi" },
  { slug: "note", label: "Not yazdı" },
  { slug: "other", label: "Diğer" },
] as const;

export type ActivityKind = (typeof ACTIVITY_KINDS)[number]["slug"];

/** Which kind an activity row is: additions, finishing (with or without a rating), a rating alone, notes, the rest. */
export function activityKind(type: string, data: Record<string, unknown>): ActivityKind {
  switch (type) {
    case "entry.suggested":
    case "entry.planned":
    case "entry.recorded":
      return "added";
    case "progress.updated":
      if (data.status === "completed") return "finished";
      return !data.status && typeof data.rating === "number" ? "rated" : "other";
    case "note.added":
    case "board.note_added":
      return "note";
    default:
      return "other";
  }
}

// What someone else is doing with an item now, in the third person ("İzliyor", "Okuyor").
const IN_PROGRESS: Record<string, string> = { book: "Okuyor", movie: "İzliyor", tv: "İzliyor", podcast: "Dinliyor", game: "Oynuyor" };
export const inProgressLabel = (mediaType: string) => IN_PROGRESS[mediaType] ?? "Devam ediyor";

/** "12 film · 3 kitap": how many of each type, in the order given (most first). */
export function describeTypeCounts(counts: readonly { label: string; count: number }[]): string {
  return counts.map(({ label, count }) => `${count} ${label.toLocaleLowerCase("tr-TR")}`).join(" · ");
}
