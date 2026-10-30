import { describe, expect, it } from "vitest";
import { canDeleteEntry, finishOnDay } from "./domain";

describe("finishOnDay", () => {
  const day = new Date("2026-10-12T09:00:00Z");

  it("moves the finish to the chosen day and keeps an earlier start", () => {
    const started = new Date("2026-10-01T09:00:00Z");
    expect(finishOnDay({ startedAt: started }, day)).toEqual({ startedAt: started, completedAt: day });
  });

  it("moves a start recorded later (or never) back to that day", () => {
    expect(finishOnDay({ startedAt: new Date("2026-10-20T09:00:00Z") }, day)).toEqual({ startedAt: day, completedAt: day });
    expect(finishOnDay({ startedAt: null }, day)).toEqual({ startedAt: day, completedAt: day });
  });
});

describe("canDeleteEntry", () => {
  it("lets the person who added it delete it", () => {
    expect(canDeleteEntry({ actorId: "a", suggestedBy: "a", canManage: false })).toBe(true);
    expect(canDeleteEntry({ actorId: "b", suggestedBy: "a", canManage: false })).toBe(false);
  });

  it("lets the list's creator and group admins delete anything, even orphaned items", () => {
    expect(canDeleteEntry({ actorId: "b", suggestedBy: "a", canManage: true })).toBe(true);
    expect(canDeleteEntry({ actorId: "b", suggestedBy: null, canManage: true })).toBe(true);
    expect(canDeleteEntry({ actorId: "b", suggestedBy: null, canManage: false })).toBe(false);
  });
});
