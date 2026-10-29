import { describe, expect, it } from "vitest";
import { canManageMember } from "./domain";

describe("canManageMember", () => {
  const admin = { actorId: "kaan", actorIsAdmin: true };

  it("lets group admins manage the other members", () => {
    expect(canManageMember({ ...admin, targetId: "ayse", targetRole: "member" })).toBe(true);
    expect(canManageMember({ ...admin, targetId: "ayse", targetRole: "admin" })).toBe(true);
  });

  it("never touches the owner or the admin's own membership", () => {
    expect(canManageMember({ ...admin, targetId: "ayse", targetRole: "owner" })).toBe(false);
    expect(canManageMember({ ...admin, targetId: "kaan", targetRole: "admin" })).toBe(false);
  });

  it("keeps plain members out", () => {
    expect(canManageMember({ actorId: "ali", actorIsAdmin: false, targetId: "ayse", targetRole: "member" })).toBe(false);
  });
});
