import { describe, expect, it } from "vitest";
import { canDeleteEntry } from "./domain";

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
