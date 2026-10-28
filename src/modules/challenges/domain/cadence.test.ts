import { describe, expect, it } from "vitest";
import { describeCadence, periodAt, periodIndexAt, periodStart, todayIn } from "./cadence";

const weekly = { unit: "week", interval: 1 } as const;
const monthly = { unit: "month", interval: 1 } as const;
const quarterly = { unit: "month", interval: 3 } as const;
const yearly = { unit: "year", interval: 1 } as const;
const none = { unit: "none", interval: 1 } as const;

describe("periodAt", () => {
  it("builds weekly periods anchored on the start date", () => {
    expect(periodAt("2026-10-12", weekly, 0)).toEqual({ index: 0, startsOn: "2026-10-12", endsOn: "2026-10-18" });
    expect(periodAt("2026-10-12", weekly, 3)).toEqual({ index: 3, startsOn: "2026-11-02", endsOn: "2026-11-08" });
  });

  it("keeps month-end anchors stable instead of drifting", () => {
    expect(periodAt("2026-01-31", monthly, 1)).toEqual({ index: 1, startsOn: "2026-02-28", endsOn: "2026-03-30" });
    expect(periodAt("2026-01-31", monthly, 2)).toEqual({ index: 2, startsOn: "2026-03-31", endsOn: "2026-04-29" });
  });

  it("supports quarterly and yearly cadences", () => {
    expect(periodAt("2026-01-01", quarterly, 1)).toEqual({ index: 1, startsOn: "2026-04-01", endsOn: "2026-06-30" });
    expect(periodAt("2024-02-29", yearly, 1)).toEqual({ index: 1, startsOn: "2025-02-28", endsOn: "2026-02-27" });
  });

  it("clips the last period to the challenge end date", () => {
    expect(periodAt("2026-01-01", monthly, 11, "2026-12-15")).toEqual({
      index: 11,
      startsOn: "2026-12-01",
      endsOn: "2026-12-15",
    });
  });

  it("returns an open-ended period for indefinite challenges", () => {
    expect(periodAt("2026-01-01", none, 0)).toEqual({ index: 0, startsOn: "2026-01-01", endsOn: null });
  });
});

describe("periodIndexAt", () => {
  it("is -1 before the start and 0 on the first day", () => {
    expect(periodIndexAt("2026-10-12", weekly, "2026-10-11")).toBe(-1);
    expect(periodIndexAt("2026-10-12", weekly, "2026-10-12")).toBe(0);
  });

  it("switches exactly on period boundaries", () => {
    expect(periodIndexAt("2026-10-12", weekly, "2026-10-18")).toBe(0);
    expect(periodIndexAt("2026-10-12", weekly, "2026-10-19")).toBe(1);
    expect(periodIndexAt("2026-10-12", { unit: "week", interval: 2 }, "2026-10-26")).toBe(1);
  });

  it("agrees with periodStart for clamped month ends", () => {
    expect(periodIndexAt("2026-01-31", monthly, "2026-02-27")).toBe(0);
    expect(periodIndexAt("2026-01-31", monthly, "2026-02-28")).toBe(1);
    expect(periodIndexAt("2026-01-31", monthly, "2026-03-30")).toBe(1);
    expect(periodIndexAt("2026-01-31", monthly, "2026-03-31")).toBe(2);
  });

  it("round-trips with periodStart over a long range", () => {
    for (const cadence of [weekly, monthly, quarterly, yearly, { unit: "day", interval: 10 } as const]) {
      for (let index = 0; index < 40; index++) {
        const start = periodStart("2025-01-31", cadence, index);
        expect(periodIndexAt("2025-01-31", cadence, start)).toBe(index);
      }
    }
  });

  it("is always 0 for indefinite challenges once started", () => {
    expect(periodIndexAt("2026-01-01", none, "2030-05-05")).toBe(0);
  });
});

describe("todayIn", () => {
  it("evaluates the calendar day in the given time zone", () => {
    const now = new Date("2026-10-15T22:30:00Z");
    expect(todayIn("Europe/Istanbul", now)).toBe("2026-10-16");
    expect(todayIn("America/New_York", now)).toBe("2026-10-15");
  });
});

describe("describeCadence", () => {
  it("names presets and custom intervals in Turkish", () => {
    expect(describeCadence(weekly)).toBe("Haftalık");
    expect(describeCadence(quarterly)).toBe("Çeyreklik");
    expect(describeCadence(none)).toBe("Süresiz");
    expect(describeCadence({ unit: "day", interval: 10 })).toBe("10 günde bir");
    expect(describeCadence({ unit: "month", interval: 6 })).toBe("6 ayda bir");
  });
});
