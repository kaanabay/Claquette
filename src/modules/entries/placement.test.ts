import { describe, expect, it } from "vitest";
import { canTakeOffRound, placeOf, waitingPlaceOf } from "./placement";

describe("placeOf", () => {
  it("reads where an item is from its round and its state's category", () => {
    expect(placeOf({ roundId: "r1", category: "active" })).toBe("round");
    expect(placeOf({ roundId: "r1", category: "pending" })).toBe("round");
    expect(placeOf({ roundId: null, category: "pending" })).toBe("waiting");
    expect(placeOf({ roundId: null, category: "active" })).toBe("off");
    expect(placeOf({ roundId: null, category: "done" })).toBe("off");
    expect(placeOf({ roundId: null, category: "dropped" })).toBe("dropped");
    expect(placeOf({ roundId: "r1", category: "dropped" })).toBe("dropped");
  });
});

describe("canTakeOffRound", () => {
  const base = {
    actorId: "kaan",
    suggestedBy: "ali",
    suggestedFor: null,
    place: "round",
    category: "active",
    isParticipant: true,
    isGroupAdmin: false,
  } as const;

  it("lets anyone taking part take an item out of a round, the pool or the suggestions", () => {
    expect(canTakeOffRound(base)).toBe(true);
    expect(canTakeOffRound({ ...base, place: "waiting", category: "pending" })).toBe(true);
    expect(canTakeOffRound({ ...base, isParticipant: false })).toBe(false);
    expect(canTakeOffRound({ ...base, isParticipant: false, isGroupAdmin: true })).toBe(true);
  });

  it("leaves a pending personal suggestion to its recipient, as accepting it would", () => {
    const suggestion = { ...base, category: "pending", suggestedFor: "deniz" } as const;
    expect(canTakeOffRound(suggestion)).toBe(false);
    expect(canTakeOffRound({ ...suggestion, actorId: "deniz" })).toBe(true);
  });

  it("has nothing to take out of an item already outside the rounds or dropped", () => {
    expect(canTakeOffRound({ ...base, place: "off" })).toBe(false);
    expect(canTakeOffRound({ ...base, place: "dropped", category: "dropped" })).toBe(false);
  });
});

describe("waitingPlaceOf", () => {
  it("is the pool of a pool list, the suggestions of a planning list, nothing elsewhere", () => {
    expect(waitingPlaceOf({ pool: true, planning: false })).toBe("pool");
    expect(waitingPlaceOf({ pool: false, planning: true })).toBe("suggestions");
    expect(waitingPlaceOf({ pool: false, planning: false })).toBeNull();
  });
});
