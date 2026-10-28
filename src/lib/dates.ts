import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { tr } from "date-fns/locale";

export function formatDate(iso: string): string {
  return format(parseISO(iso), "d MMMM yyyy", { locale: tr });
}

/** "13–19 Eki", "28 Eki – 3 Kas", "28 Ara 2026 – 3 Oca 2027", "Başlangıç: 13 Eki 2026" */
export function formatDateRange(startsOn: string, endsOn: string | null): string {
  const start = parseISO(startsOn);
  if (!endsOn) return `Başlangıç: ${format(start, "d MMM yyyy", { locale: tr })}`;
  const end = parseISO(endsOn);
  if (start.getFullYear() !== end.getFullYear()) {
    return `${format(start, "d MMM yyyy", { locale: tr })} – ${format(end, "d MMM yyyy", { locale: tr })}`;
  }
  if (start.getMonth() === end.getMonth()) {
    return `${format(start, "d", { locale: tr })}–${format(end, "d MMM", { locale: tr })}`;
  }
  return `${format(start, "d MMM", { locale: tr })} – ${format(end, "d MMM", { locale: tr })}`;
}

/** "az önce", "3 gün önce" — call only during request-time rendering (it reads the clock). */
export function timeAgo(date: Date): string {
  if (Date.now() - date.getTime() < 60_000) return "az önce";
  return formatDistanceToNowStrict(date, { locale: tr, addSuffix: true });
}
