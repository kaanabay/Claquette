import { describe, expect, it } from "vitest";
import {
  canAcceptSuggestion,
  currentRoundIndex,
  formatPeriodLabel,
  isPlanStateChangeAllowed,
  lastRoundIndex,
  listSlots,
  planHorizon,
  slotTiming,
} from "./plan";

const quarterly2027 = { startsOn: "2027-01-01", endsOn: "2027-12-31", cadence: { unit: "month", interval: 3 } } as const;
const monthlyOpen = { startsOn: "2026-01-01", endsOn: null, cadence: { unit: "month", interval: 1 } } as const;

describe("round positions", () => {
  it("counts the rounds of a fixed-length list", () => {
    expect(lastRoundIndex(quarterly2027)).toBe(3);
    expect(lastRoundIndex(monthlyOpen)).toBeNull();
  });

  it("is -1 before the start and one past the end afterwards", () => {
    expect(currentRoundIndex(quarterly2027, "2026-12-10")).toBe(-1);
    expect(currentRoundIndex(quarterly2027, "2027-05-02")).toBe(1);
    expect(currentRoundIndex(quarterly2027, "2028-01-01")).toBe(4);
  });

  it("classifies rounds around the current one", () => {
    expect([0, 1, 2].map((index) => slotTiming(index, 1))).toEqual(["past", "current", "future"]);
    expect(slotTiming(0, -1)).toBe("future");
  });
});

describe("planHorizon", () => {
  it("shows every round of a short fixed-length list, even before it starts", () => {
    expect(planHorizon(quarterly2027, "2026-12-10", -1, "show")).toBe(3);
  });

  it("shows a few empty rounds ahead of an open-ended list", () => {
    expect(planHorizon(monthlyOpen, "2026-10-22", -1, "show")).toBe(12); // Oct = 9, +3
  });

  it("keeps rounds planned far ahead visible", () => {
    expect(planHorizon(monthlyOpen, "2026-10-22", 20, "show")).toBe(21);
  });

  it("offers many more rounds when choosing, and never past the end", () => {
    expect(planHorizon(monthlyOpen, "2026-10-22", -1, "select")).toBe(9 + 24);
    expect(planHorizon(monthlyOpen, "2026-10-22", 40, "select")).toBe(40 + 24);
    expect(planHorizon(quarterly2027, "2026-12-10", -1, "select")).toBe(3);
  });
});

describe("listSlots", () => {
  it("lays out a whole year of quarters before the list starts, created or not", () => {
    const rounds = [{ id: "r0", index: 0, startsOn: "2027-01-01", endsOn: "2027-03-31", closedAt: null }];
    const slots = listSlots({
      calendar: quarterly2027,
      today: "2026-12-10",
      rounds,
      filledByRound: new Map([["r0", 1]]),
      mode: "show",
    });
    expect(slots.map((slot) => [slot.label, slot.timing, slot.roundId, slot.filled])).toEqual([
      ["Ocak–Mart 2027", "future", "r0", 1],
      ["Nisan–Haziran 2027", "future", null, 0],
      ["Temmuz–Eylül 2027", "future", null, 0],
      ["Ekim–Aralık 2027", "future", null, 0],
    ]);
  });

  it("marks past and current rounds of a running list", () => {
    const slots = listSlots({
      calendar: monthlyOpen,
      today: "2026-03-15",
      rounds: [],
      filledByRound: new Map(),
      mode: "show",
    });
    expect(slots.slice(0, 4).map((slot) => slot.timing)).toEqual(["past", "past", "current", "future"]);
    expect(slots).toHaveLength(6); // Jan…Jun: current (Mar) + 3 ahead
  });

  it("lists only started turns of an indefinite list", () => {
    const slots = listSlots({
      calendar: { startsOn: "2026-01-01", endsOn: null, cadence: { unit: "none", interval: 1 } },
      today: "2026-10-22",
      rounds: [
        { id: "b", index: 1, startsOn: "2026-05-01", endsOn: null, closedAt: null },
        { id: "a", index: 0, startsOn: "2026-01-01", endsOn: "2026-04-30", closedAt: new Date() },
      ],
      filledByRound: new Map(),
      mode: "select",
    });
    expect(slots.map((slot) => [slot.label, slot.timing])).toEqual([
      ["Tur 1", "past"],
      ["Tur 2", "current"],
    ]);
  });
});

describe("canAcceptSuggestion", () => {
  const base = { actorId: "a", suggestedBy: "b", isParticipant: true, isGroupAdmin: false, participantCount: 2 };

  it("lets another participant accept", () => {
    expect(canAcceptSuggestion(base)).toBe(true);
    expect(canAcceptSuggestion({ ...base, isParticipant: false })).toBe(false);
  });

  it("keeps the author from accepting their own idea unless alone, even as an admin", () => {
    expect(canAcceptSuggestion({ ...base, actorId: "b" })).toBe(false);
    expect(canAcceptSuggestion({ ...base, actorId: "b", participantCount: 1 })).toBe(true);
    expect(canAcceptSuggestion({ ...base, actorId: "b", isGroupAdmin: true })).toBe(false);
  });

  it("lets a group admin who doesn't take part accept others' ideas", () => {
    expect(canAcceptSuggestion({ ...base, isParticipant: false, isGroupAdmin: true })).toBe(true);
  });
});

describe("isPlanStateChangeAllowed", () => {
  it("accepts suggestions only by placing them, and takes items out of rounds explicitly", () => {
    expect(isPlanStateChangeAllowed({ inRound: false, targetCategory: "active" })).toBe(false);
    expect(isPlanStateChangeAllowed({ inRound: false, targetCategory: "done" })).toBe(false);
    expect(isPlanStateChangeAllowed({ inRound: false, targetCategory: "dropped" })).toBe(true);
    expect(isPlanStateChangeAllowed({ inRound: false, targetCategory: "pending" })).toBe(true);
    expect(isPlanStateChangeAllowed({ inRound: true, targetCategory: "pending" })).toBe(false);
    expect(isPlanStateChangeAllowed({ inRound: true, targetCategory: "done" })).toBe(true);
  });
});

describe("formatPeriodLabel", () => {
  it("names whole months, quarters and calendar years", () => {
    expect(formatPeriodLabel("2026-11-01", "2026-11-30")).toBe("Kasım 2026");
    expect(formatPeriodLabel("2027-01-01", "2027-03-31")).toBe("Ocak–Mart 2027");
    expect(formatPeriodLabel("2027-01-01", "2027-12-31")).toBe("2027");
    expect(formatPeriodLabel("2026-12-01", "2027-02-28")).toBe("Ara 2026 – Şub 2027");
  });

  it("falls back to date ranges for other periods", () => {
    expect(formatPeriodLabel("2026-10-12", "2026-10-18")).toBe("12–18 Eki");
    expect(formatPeriodLabel("2026-10-22", "2027-01-21")).toBe("22 Eki 2026 – 21 Oca 2027");
  });
});
