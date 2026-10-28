// Days as people read them, in Turkey's time: the same string on the server and in the browser,
// so client components don't drift while hydrating.

const SHORT = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Istanbul" });
const ISO_DAY = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul" });

/** "3 Oca 2026" */
export const formatShortDate = (date: Date) => SHORT.format(date);

/** "2026-01-03", the value of a date input. */
export const toDayValue = (date: Date) => ISO_DAY.format(date);

/** A chosen day as a moment: noon in Turkey, so no time zone moves it to another day. */
export const fromDayValue = (day: string) => new Date(`${day}T12:00:00+03:00`);
