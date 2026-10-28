import { describe, expect, it } from "vitest";
import { canChangeState, initialState, stateKeys, type StateCategory } from "./domain";

describe("stateKeys", () => {
  it("transliterates Turkish labels and keeps keys unique", () => {
    expect(stateKeys(["Kabul Edildi", "Okunuyor / İzleniyor", "Çöpe atıldı", "Kabul edildi", "!!!"])).toEqual([
      "kabul_edildi",
      "okunuyor_izleniyor",
      "cope_atildi",
      "kabul_edildi_2",
      "durum",
    ]);
  });
});

const states = [
  { id: "s3", category: "done" as const, position: 3 },
  { id: "s1", category: "pending" as const, position: 1 },
  { id: "s4", category: "dropped" as const, position: 4 },
  { id: "s2", category: "active" as const, position: 2 },
  { id: "s2b", category: "active" as const, position: 5 },
];

describe("initialState", () => {
  it("picks the first state of the preferred category by position", () => {
    expect(initialState(states, "pending").id).toBe("s1");
    expect(initialState(states, "active").id).toBe("s2");
  });

  it("falls back to the first state when the category is missing", () => {
    expect(initialState([{ id: "only", category: "active" as const, position: 7 }], "pending").id).toBe("only");
  });
});

describe("canChangeState", () => {
  const base = {
    actorId: "a",
    suggestedBy: "b",
    suggestedFor: "a",
    currentCategory: "pending" as StateCategory,
    targetCategory: "active" as StateCategory,
    isParticipant: true,
    isGroupAdmin: false,
  };

  it("lets the recipient answer a pending personal suggestion", () => {
    expect(canChangeState(base)).toBe(true);
  });

  it("lets the author only withdraw it", () => {
    expect(canChangeState({ ...base, actorId: "b" })).toBe(false);
    expect(canChangeState({ ...base, actorId: "b", targetCategory: "dropped" })).toBe(true);
  });

  it("keeps third parties out of someone else's pending suggestion", () => {
    expect(canChangeState({ ...base, actorId: "c" })).toBe(false);
    expect(canChangeState({ ...base, actorId: "c", isGroupAdmin: true })).toBe(true);
  });

  it("opens everything else to participants", () => {
    expect(canChangeState({ ...base, actorId: "c", currentCategory: "active", targetCategory: "done" })).toBe(true);
    expect(canChangeState({ ...base, actorId: "c", suggestedFor: null })).toBe(true);
    expect(canChangeState({ ...base, actorId: "x", suggestedFor: null, isParticipant: false })).toBe(false);
  });
});
