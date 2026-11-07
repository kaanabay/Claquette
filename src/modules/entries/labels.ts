import type { FinishedChoice } from "./tracking";

export const PROGRESS_STATUSES = ["planned", "in_progress", "completed", "dropped", "skipped"] as const;
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number];

const DEFAULT_LABELS: Record<ProgressStatus, string> = {
  planned: "Sırada",
  in_progress: "Devam ediyorum",
  completed: "Bitirdim",
  dropped: "Yarım bıraktım",
  skipped: "Pas geçiyorum",
};

// Verbs read naturally per media type; unknown types use the defaults.
const TYPE_LABELS: Record<string, Partial<Record<ProgressStatus, string>>> = {
  book: { in_progress: "Okuyorum", completed: "Okudum", skipped: "Okumayacağım" },
  movie: { in_progress: "İzliyorum", completed: "İzledim", skipped: "İzlemeyeceğim" },
  tv: { in_progress: "İzliyorum", completed: "İzledim", skipped: "İzlemeyeceğim" },
  podcast: { in_progress: "Dinliyorum", completed: "Dinledim", skipped: "Dinlemeyeceğim" },
  game: { in_progress: "Oynuyorum", skipped: "Oynamayacağım" },
};

export function progressLabel(status: ProgressStatus, mediaType?: string): string {
  return (mediaType && TYPE_LABELS[mediaType]?.[status]) || DEFAULT_LABELS[status];
}

/** Who an item is meant for, as the "who finished it?" question addresses them. */
export type FinishedAudience = { kind: "group" } | { kind: "me" } | { kind: "person"; name: string };

/** Everyone taking part; a list of one is just "me". */
export const groupAudience = (participantCount: number): FinishedAudience =>
  participantCount <= 1 ? { kind: "me" } : { kind: "group" };

/** "Who finished it?" for an item going into a round that is already over; the first is the default. */
export function finishedChoices(audience: FinishedAudience): { value: FinishedChoice; label: string }[] {
  if (audience.kind === "me") {
    return [
      { value: "all", label: "Bitirdim" },
      { value: "none", label: "Henüz bitmedi" },
    ];
  }
  if (audience.kind === "person") {
    return [
      { value: "all", label: `${audience.name.split(" ")[0]} bitirdi` },
      { value: "none", label: "Henüz bitirmedi" },
    ];
  }
  return [
    { value: "all", label: "Hepimiz bitirdik" },
    { value: "me", label: "Sadece ben bitirdim" },
    { value: "none", label: "Henüz bitmedi" },
  ];
}

/**
 * "Who finished it?" for an item added as "Tur dışı", about the person it is credited to: usually
 * the reason it stays out of the rounds is that only they have finished it, so that comes first.
 */
export function offRoundChoices(input: {
  participantCount: number;
  credited: { isViewer: boolean; name: string };
}): { value: FinishedChoice; label: string }[] {
  const name = input.credited.name.split(" ")[0];
  if (input.participantCount <= 1) {
    return input.credited.isViewer
      ? [
          { value: "all", label: "Bitirdim" },
          { value: "none", label: "Henüz bitirmedim" },
        ]
      : [
          { value: "all", label: `${name} bitirdi` },
          { value: "none", label: "Henüz bitirmedi" },
        ];
  }
  return [
    { value: "me", label: input.credited.isViewer ? "Sadece ben bitirdim" : `Sadece ${name} bitirdi` },
    { value: "all", label: "Hepimiz bitirdik" },
    { value: "none", label: "Henüz kimse bitirmedi" },
  ];
}

/** Ratings are 1–10; averages keep one decimal ("7,5"). */
export function formatRating(rating: number): string {
  return rating.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
}
