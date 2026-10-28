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
 * Why the user can't add to the list right now, for the list page. Rules that only fill a running
 * round can't take anything before the first one starts, so say when that is and how to plan ahead.
 */
export function addBlockedReason(input: { reason: string; today: string; startsOn: string; isPlanning: boolean }): string {
  if (!input.isPlanning && input.today < input.startsOn) {
    return `Bu listenin kuralında ekleme tur sırasında yapılıyor; ilk tur ${formatDate(input.startsOn)} tarihinde başlıyor. Turları önceden doldurmak için liste “Birlikte belirliyoruz” kuralıyla kurulmalı.`;
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
