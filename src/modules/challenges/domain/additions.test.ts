import { describe, expect, it } from "vitest";
import { canAddAs, fillSlots, poolRoundOptions, roundOptions, slotKey, startingCategory } from "./additions";
import { openStrategy } from "./strategies/open";
import { rotationStrategy } from "./strategies/rotation";

const people = (...ids: string[]) => ids.map((userId, position) => ({ userId, position }));

describe("canAddAs", () => {
  const base = { actorId: "kaan", creditedIsParticipant: true };

  it("lets anyone taking part add their own item", () => {
    expect(canAddAs({ ...base, creditedId: "kaan", actorIsParticipant: true, isAdmin: false }).ok).toBe(true);
    expect(canAddAs({ ...base, creditedId: "kaan", actorIsParticipant: false, isAdmin: true })).toEqual({
      ok: false,
      reason: "Eklemek için önce listeye katıl.",
    });
  });

  it("leaves someone else's item to group admins, for people taking part", () => {
    expect(canAddAs({ ...base, creditedId: "ali", actorIsParticipant: true, isAdmin: false })).toEqual({
      ok: false,
      reason: "Başkası adına yalnızca grup yöneticileri ekleyebilir.",
    });
    expect(canAddAs({ ...base, creditedId: "ali", actorIsParticipant: false, isAdmin: true }).ok).toBe(true);
    expect(canAddAs({ ...base, creditedId: "ali", actorIsParticipant: true, isAdmin: true, creditedIsParticipant: false }).ok).toBe(false);
  });
});

describe("startingCategory", () => {
  it("accepts what happened in a round that is over", () => {
    expect(startingCategory({ timing: "past", onBehalf: false, ruleCategory: "pending" })).toBe("active");
  });

  it("accepts a round's item added for someone else, now or ahead", () => {
    expect(startingCategory({ timing: "current", onBehalf: true, ruleCategory: "pending" })).toBe("active");
    expect(startingCategory({ timing: "future", onBehalf: true, ruleCategory: "pending" })).toBe("active");
  });

  it("follows the list's rule otherwise, a pool candidate added for someone too", () => {
    expect(startingCategory({ timing: "future", onBehalf: false, ruleCategory: "pending" })).toBe("pending");
    expect(startingCategory({ timing: "current", onBehalf: false, ruleCategory: "active" })).toBe("active");
    expect(startingCategory({ timing: null, onBehalf: true, ruleCategory: "pending" })).toBe("pending");
  });
});

describe("poolRoundOptions", () => {
  const rules = { picksPerRound: 2, selection: "votes" as const, autoDraw: true };

  it("takes as many items as the round's selection, for everyone", () => {
    expect(poolRoundOptions(rules, 1)).toEqual({ allowed: true, placement: "round", targets: [null], remaining: 1, initialCategory: "active" });
    expect(poolRoundOptions(rules, 2)).toEqual({ allowed: false, reason: "Bu turun seçimi zaten tamamlandı." });
  });
});

describe("roundOptions", () => {
  const pairs = { mode: "pairs" as const, picksPerTurn: 1, requireAcceptance: true };
  const assignments = [
    { pickerId: "kaan", recipientId: "ali" },
    { pickerId: "ali", recipientId: "kaan" },
  ];

  it("asks the rotation about any round: the picker's own recipient, once", () => {
    const round = { index: 4, assignments, items: [] };
    expect(roundOptions(rotationStrategy, pairs, round, people("kaan", "ali"), "kaan")).toMatchObject({ allowed: true, targets: ["ali"] });
    const filled = { ...round, items: [{ suggestedBy: "kaan", recipientId: "ali" }] };
    expect(roundOptions(rotationStrategy, pairs, filled, people("kaan", "ali"), "kaan").allowed).toBe(false);
    // Someone else's pick in that round doesn't use up mine.
    const theirs = { ...round, items: [{ suggestedBy: "ali", recipientId: "kaan" }] };
    expect(roundOptions(rotationStrategy, pairs, theirs, people("kaan", "ali"), "kaan").allowed).toBe(true);
  });

  it("counts an open list's limit per person, per round", () => {
    const config = { maxPerRound: 1, allowGroupTarget: true, requireAcceptance: false };
    const round = { index: 2, assignments: [], items: [{ suggestedBy: "kaan", recipientId: null }] };
    expect(roundOptions(openStrategy, config, round, people("kaan", "ali"), "kaan").allowed).toBe(false);
    expect(roundOptions(openStrategy, config, round, people("kaan", "ali"), "ali")).toMatchObject({ allowed: true, targets: [null, "kaan"] });
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
    const { slots, extras } = fillSlots(assignments, [item("persona", "ali", "kaan")], pairOf);
    expect(slots.map((slot) => [slotKey(slot), slot.entries.map((entry) => entry.id)])).toEqual([
      ["ali:kaan", ["persona"]],
      ["kaan:ali", []],
    ]);
    expect(extras).toEqual([]);
  });

  it("keeps picks that fit no assignment as extras instead of hiding them", () => {
    const { slots, extras } = fillSlots(assignments, [item("ordet", "ayse", "kaan"), item("vampyr", "ali", null)], pairOf);
    expect(slots.every((slot) => slot.entries.length === 0)).toBe(true);
    expect(extras.map((entry) => entry.id)).toEqual(["ordet", "vampyr"]);
  });
});
