import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  format,
  parseISO,
  subDays,
} from "date-fns";

// Period math on plain ISO dates ("2026-10-16"), so time zones and DST never shift a boundary.
// Periods are anchored on the challenge start date: period k starts at start + k × interval.

export const CADENCE_UNITS = ["day", "week", "month", "year", "none"] as const;
export type CadenceUnit = (typeof CADENCE_UNITS)[number];
export type Cadence = { unit: CadenceUnit; interval: number };

/** A period with an inclusive end date; `endsOn` is null for open-ended (indefinite) turns. */
export type Period = { index: number; startsOn: string; endsOn: string | null };

export const CADENCE_PRESETS = [
  { key: "weekly", label: "Haftalık", unit: "week", interval: 1 },
  { key: "biweekly", label: "İki haftada bir", unit: "week", interval: 2 },
  { key: "monthly", label: "Aylık", unit: "month", interval: 1 },
  { key: "quarterly", label: "Çeyreklik (3 ayda bir)", unit: "month", interval: 3 },
  { key: "yearly", label: "Yıllık", unit: "year", interval: 1 },
  { key: "indefinite", label: "Süresiz", unit: "none", interval: 1 },
] as const satisfies ReadonlyArray<{ key: string; label: string } & Cadence>;

const toIso = (date: Date) => format(date, "yyyy-MM-dd");

export function isTimeBased(cadence: Cadence): boolean {
  return cadence.unit !== "none";
}

/** First day of period `index`. Always computed from the anchor, so month ends don't drift. */
export function periodStart(startsOn: string, cadence: Cadence, index: number): string {
  const start = parseISO(startsOn);
  const steps = index * cadence.interval;
  switch (cadence.unit) {
    case "day":
      return toIso(addDays(start, steps));
    case "week":
      return toIso(addWeeks(start, steps));
    case "month":
      return toIso(addMonths(start, steps));
    case "year":
      return toIso(addYears(start, steps));
    case "none":
      return startsOn;
  }
}

/** Bounds of period `index`; the last period is clipped to the challenge end date. */
export function periodAt(startsOn: string, cadence: Cadence, index: number, endsOn?: string | null): Period {
  if (!isTimeBased(cadence)) return { index, startsOn, endsOn: endsOn ?? null };
  const start = periodStart(startsOn, cadence, index);
  const nextStart = parseISO(periodStart(startsOn, cadence, index + 1));
  let end = toIso(subDays(nextStart, 1));
  if (endsOn && end > endsOn) end = endsOn;
  return { index, startsOn: start, endsOn: end };
}

/** Index of the period that contains `date`, or -1 before the start. */
export function periodIndexAt(startsOn: string, cadence: Cadence, date: string): number {
  if (date < startsOn) return -1;
  if (cadence.unit === "none") return 0;

  const start = parseISO(startsOn);
  const target = parseISO(date);
  let estimate: number;
  switch (cadence.unit) {
    case "day":
      estimate = differenceInCalendarDays(target, start) / cadence.interval;
      break;
    case "week":
      estimate = differenceInCalendarDays(target, start) / (7 * cadence.interval);
      break;
    case "month":
      estimate = differenceInCalendarMonths(target, start) / cadence.interval;
      break;
    case "year":
      estimate = differenceInCalendarMonths(target, start) / (12 * cadence.interval);
      break;
  }

  // Month arithmetic clamps (Jan 31 + 1 month = Feb 28), so settle on the real boundaries.
  let index = Math.max(0, Math.floor(estimate));
  while (index > 0 && periodStart(startsOn, cadence, index) > date) index--;
  while (periodStart(startsOn, cadence, index + 1) <= date) index++;
  return index;
}

/** "Today" as an ISO date in the given IANA time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const UNIT_LOCATIVE: Record<Exclude<CadenceUnit, "none">, string> = {
  day: "günde",
  week: "haftada",
  month: "ayda",
  year: "yılda",
};

/** Human label, e.g. "Haftalık", "Çeyreklik", "10 günde bir", "Süresiz". */
export function describeCadence(cadence: Cadence): string {
  if (cadence.unit === "none") return "Süresiz";
  const preset = CADENCE_PRESETS.find((p) => p.unit === cadence.unit && p.interval === cadence.interval);
  if (preset) return preset.key === "quarterly" ? "Çeyreklik" : preset.label;
  if (cadence.interval === 1 && cadence.unit === "day") return "Günlük";
  return `${cadence.interval} ${UNIT_LOCATIVE[cadence.unit]} bir`;
}
