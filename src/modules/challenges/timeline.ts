import { differenceInCalendarDays, parseISO } from "date-fns";
import { formatDate, formatDateRange } from "@/lib/dates";

type TimelineInput = {
  status: "active" | "paused" | "archived";
  startsOn: string;
  endsOn: string | null;
  cadenceUnit: string;
  latestRound: { index: number; startsOn: string; endsOn: string | null } | null;
};

export const CHALLENGE_STATUS_LABELS = { active: "Aktif", paused: "Duraklatıldı", archived: "Arşivlendi" } as const;

/** One-line state of a challenge: "Tur 5 · 13–19 Eki", "1 Kasım 2026 tarihinde başlıyor", ... */
export function describeTimeline(challenge: TimelineInput, today: string): string {
  if (challenge.status !== "active") return CHALLENGE_STATUS_LABELS[challenge.status];
  if (today < challenge.startsOn) return `${formatDate(challenge.startsOn)} tarihinde başlıyor`;
  if (challenge.endsOn && today > challenge.endsOn) return `${formatDate(challenge.endsOn)} tarihinde sona erdi`;
  const round = challenge.latestRound;
  if (!round) return "Başlıyor";
  if (challenge.cadenceUnit === "none") return `Tur ${round.index + 1} sürüyor`;
  return `Tur ${round.index + 1} · ${formatDateRange(round.startsOn, round.endsOn)}`;
}

/**
 * Why the user can't add to the list right now, for the list page. An indefinite list's turns open
 * only once it starts (`opensEarly`: planning, or rounds on a calendar, take items before), so say
 * when that is and how to plan ahead.
 */
export function addBlockedReason(input: { reason: string; today: string; startsOn: string; opensEarly: boolean }): string {
  if (!input.opensEarly && input.today < input.startsOn) {
    return `Süresiz listede turlar başladıkça açılır; ilk tur ${formatDate(input.startsOn)} tarihinde başlıyor. Turları önceden doldurmak için listeye bir sıklık ver.`;
  }
  return input.reason;
}

/** "3 gün kaldı", "son gün" — null for open-ended rounds. */
export function daysLeft(endsOn: string | null, today: string): string | null {
  if (!endsOn) return null;
  const days = differenceInCalendarDays(parseISO(endsOn), parseISO(today));
  if (days < 0) return null;
  return days === 0 ? "son gün" : `${days} gün kaldı`;
}

/** "yarın başlıyor", "5 gün sonra başlıyor" — null once it has started. */
export function startsIn(startsOn: string, today: string): string | null {
  const days = differenceInCalendarDays(parseISO(startsOn), parseISO(today));
  if (days <= 0) return null;
  return days === 1 ? "yarın başlıyor" : `${days} gün sonra başlıyor`;
}

/** "dün bitti", "12 gün önce bitti" (a turn closed by hand may end "bugün") — null while it runs. */
export function endedAgo(endsOn: string | null, today: string): string | null {
  if (!endsOn) return null;
  const days = differenceInCalendarDays(parseISO(today), parseISO(endsOn));
  if (days < 0) return null;
  return days === 0 ? "bugün bitti" : days === 1 ? "dün bitti" : `${days} gün önce bitti`;
}
