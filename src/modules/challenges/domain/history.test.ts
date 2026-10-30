import { describe, expect, it } from "vitest";
import { canRecordPick, fillSlots, parseSlotKey, slotKey } from "./history";

describe("canRecordPick", () => {
  const member = { isParticipant: true, isAdmin: false };
  const admin = { isParticipant: true, isAdmin: true };

  it("lets a picker enter their own pick once its round is over", () => {
    expect(canRecordPick({ actorId: "ali", pickerId: "ali", timing: "past", ...member }).ok).toBe(true);
  });

  it("sends a picker's pick for the current round through the usual suggestion, admins included", () => {
    expect(canRecordPick({ actorId: "ali", pickerId: "ali", timing: "current", ...member }).ok).toBe(false);
    expect(canRecordPick({ actorId: "kaan", pickerId: "kaan", timing: "current", ...admin }).ok).toBe(false);
  });

  it("leaves someone else's pick to group admins, then or now", () => {
    expect(canRecordPick({ actorId: "ali", pickerId: "ayse", timing: "past", ...member })).toEqual({
      ok: false,
      reason: "Başkasının önerisini yalnızca grup yöneticileri girebilir.",
    });
    expect(canRecordPick({ actorId: "kaan", pickerId: "ayse", timing: "past", ...admin }).ok).toBe(true);
    expect(canRecordPick({ actorId: "kaan", pickerId: "ayse", timing: "current", ...admin }).ok).toBe(true);
    expect(canRecordPick({ actorId: "site", pickerId: "ayse", timing: "past", isParticipant: false, isAdmin: true }).ok).toBe(true);
  });

  it("asks someone who left the list to join again before filling in their turns", () => {
    expect(canRecordPick({ actorId: "ali", pickerId: "ali", timing: "past", isParticipant: false, isAdmin: false }).ok).toBe(false);
  });
});

describe("slot keys", () => {
  it("round-trip an assignment, the whole group included", () => {
    expect(slotKey({ pickerId: "ali", recipientId: "kaan" })).toBe("ali:kaan");
    expect(slotKey({ pickerId: "ali", recipientId: null })).toBe("ali:group");
    expect(parseSlotKey("ali:kaan")).toEqual({ pickerId: "ali", recipientId: "kaan" });
    expect(parseSlotKey("ali:group")).toEqual({ pickerId: "ali", recipientId: null });
  });

  it("refuses anything else", () => {
    for (const key of ["", "ali", "ali:", ":kaan", "ali:kaan:ayse"]) expect(parseSlotKey(key)).toBeNull();
  });
});

describe("fillSlots", () => {
  const assignments = [
    { pickerId: "ali", recipientId: "kaan" },
    { pickerId: "kaan", recipientId: "ali" },
  ];
  const item = (id: string, by: string | null, to: string | null) => ({ id, by, to });
  const pairOf = (entry: ReturnType<typeof item>) => ({ pickerId: entry.by, recipientId: entry.to });

  it("puts each pick under the assignment with the same picker and recipient", () => {
    const { slots, extras } = fillSlots(assignments, [item("persona", "ali", "kaan")], pairOf, 1);
    expect(slots.map((slot) => [slot.pickerId, slot.entries.map((entry) => entry.id), slot.open])).toEqual([
      ["ali", ["persona"], 0],
      ["kaan", [], 1],
    ]);
    expect(extras).toEqual([]);
  });

  it("leaves room while an assignment takes more picks", () => {
    const { slots } = fillSlots(assignments, [item("persona", "ali", "kaan")], pairOf, 2);
    expect(slots[0].open).toBe(1);
  });

  it("keeps picks that fit no assignment as extras instead of hiding them", () => {
    const { slots, extras } = fillSlots(assignments, [item("ordet", "ayse", "kaan"), item("vampyr", "ali", null)], pairOf, 1);
    expect(slots.every((slot) => slot.entries.length === 0)).toBe(true);
    expect(extras.map((entry) => entry.id)).toEqual(["ordet", "vampyr"]);
  });

  it("matches a pick for the whole group only to a group assignment", () => {
    const { slots, extras } = fillSlots([{ pickerId: "ali", recipientId: null }], [item("dune", "ali", null)], pairOf, 1);
    expect(slots[0].entries.map((entry) => entry.id)).toEqual(["dune"]);
    expect(extras).toEqual([]);
  });
});
