import { describe, expect, it } from "vitest";
import {
  configFieldName,
  defaultConfig,
  getStrategy,
  parseStoredConfig,
  pickFromPool,
  readConfigFromForm,
  type SuggestionContext,
} from ".";
import { jointStrategy } from "./joint";
import { openStrategy } from "./open";
import { poolStrategy } from "./pool";
import { rotationStrategy, type RotationConfig } from "./rotation";

const people = (...ids: string[]) => ids.map((userId, position) => ({ userId, position }));

function context<C>(overrides: Partial<SuggestionContext<C>> & { config: C }): SuggestionContext<C> {
  return {
    userId: "a",
    participants: people("a", "b", "c"),
    round: { index: 0 },
    assignments: [],
    roundSuggestions: [],
    poolCandidates: 0,
    ...overrides,
  };
}

describe("rotation strategy", () => {
  const pairs: RotationConfig = { mode: "pairs", picksPerTurn: 1, requireAcceptance: true };
  const turns: RotationConfig = { ...pairs, mode: "turns" };

  it("makes two people exchange suggestions every round", () => {
    for (const roundIndex of [0, 1, 7]) {
      expect(rotationStrategy.planRound({ config: pairs, roundIndex, participants: people("a", "b") })).toEqual([
        { pickerId: "a", recipientId: "b" },
        { pickerId: "b", recipientId: "a" },
      ]);
    }
  });

  it("covers every ordered pair over n-1 rounds and never self-assigns", () => {
    const participants = people("a", "b", "c", "d");
    const seen = new Set<string>();
    for (let roundIndex = 0; roundIndex < participants.length - 1; roundIndex++) {
      const plan = rotationStrategy.planRound({ config: pairs, roundIndex, participants });
      expect(new Set(plan.map((p) => p.recipientId)).size).toBe(participants.length);
      for (const { pickerId, recipientId } of plan) {
        expect(pickerId).not.toBe(recipientId);
        seen.add(`${pickerId}->${recipientId}`);
      }
    }
    expect(seen.size).toBe(4 * 3);
  });

  it("gives each round to the next picker in turns mode", () => {
    const participants = people("a", "b", "c");
    const pickers = [0, 1, 2, 3].map((roundIndex) => rotationStrategy.planRound({ config: turns, roundIndex, participants })[0]);
    expect(pickers.map((p) => p.pickerId)).toEqual(["a", "b", "c", "a"]);
    expect(pickers.every((p) => p.recipientId === null)).toBe(true);
  });

  it("only lets the assigned picker suggest, to the assigned recipient", () => {
    const assignments = [
      { pickerId: "a", recipientId: "b" },
      { pickerId: "b", recipientId: "a" },
    ];
    expect(rotationStrategy.suggestionOptions(context({ config: pairs, assignments }))).toMatchObject({
      allowed: true,
      targets: ["b"],
      remaining: 1,
      initialCategory: "pending",
    });
    expect(rotationStrategy.suggestionOptions(context({ config: pairs, assignments, userId: "c" }))).toMatchObject({
      allowed: false,
    });
  });

  it("closes the turn once the quota is used", () => {
    const assignments = [{ pickerId: "a", recipientId: "b" }];
    const options = rotationStrategy.suggestionOptions(
      context({ config: pairs, assignments, roundSuggestions: [{ recipientId: "b" }] }),
    );
    expect(options).toEqual({ allowed: false, reason: "Bu turdaki önerilerini tamamladın." });
  });

  it("starts suggestions as active when acceptance is not required", () => {
    const options = rotationStrategy.suggestionOptions(
      context({ config: { ...turns, requireAcceptance: false }, assignments: [{ pickerId: "a", recipientId: null }] }),
    );
    expect(options).toMatchObject({ allowed: true, targets: [null], initialCategory: "active" });
  });

  it("lets past turns be filled in, as many picks per assignment as a turn takes", () => {
    expect(rotationStrategy.history?.(pairs)).toEqual({ picksPerAssignment: 1 });
    expect(rotationStrategy.history?.({ ...turns, picksPerTurn: 3 })).toEqual({ picksPerAssignment: 3 });
  });
});

describe("open strategy", () => {
  const config = { maxPerRound: 2, allowGroupTarget: true, requireAcceptance: true };

  it("allows the group and every other participant as targets", () => {
    expect(openStrategy.suggestionOptions(context({ config }))).toMatchObject({
      allowed: true,
      targets: [null, "b", "c"],
      remaining: 2,
    });
  });

  it("enforces the per-round limit", () => {
    const options = openStrategy.suggestionOptions(
      context({ config, roundSuggestions: [{ recipientId: "b" }, { recipientId: null }] }),
    );
    expect(options.allowed).toBe(false);
  });

  it("needs a round", () => {
    expect(openStrategy.suggestionOptions(context({ config, round: null })).allowed).toBe(false);
  });
});

describe("pool strategy", () => {
  it("collects candidates in the pool, even before the first round", () => {
    const config = defaultConfig(poolStrategy) as ReturnType<typeof poolStrategy.configSchema.parse>;
    expect(poolStrategy.suggestionOptions(context({ config, round: null }))).toMatchObject({
      allowed: true,
      placement: "pool",
      targets: [null],
    });
  });

  it("disables auto draw for manual selection", () => {
    expect(poolStrategy.poolRules?.({ selection: "manual", picksPerRound: 1, autoDraw: true, maxCandidatesPerUser: 0 }))
      .toMatchObject({ autoDraw: false });
  });

  it("picks the most voted candidates and breaks ties randomly", () => {
    const candidates = [
      { id: "x", votes: 1 },
      { id: "y", votes: 3 },
      { id: "z", votes: 3 },
      { id: "w", votes: 0 },
    ];
    const top = pickFromPool(candidates, 2, "votes", () => 0.5).map((c) => c.id);
    expect(top.sort()).toEqual(["y", "z"]);
    expect(pickFromPool(candidates, 1, "manual")).toEqual([]);
    expect(pickFromPool(candidates, 10, "random")).toHaveLength(4);
  });
});

describe("joint strategy", () => {
  it("lets every participant add, even with no round running, and assigns nobody", () => {
    const config = { itemsPerRound: 1 };
    expect(jointStrategy.planRound({ config, roundIndex: 0, participants: people("a", "b") })).toEqual([]);
    expect(jointStrategy.suggestionOptions(context({ config, round: null }))).toMatchObject({
      allowed: true,
      placement: "plan",
      targets: [null],
    });
  });

  it("maps 0 to an unlimited round size", () => {
    expect(jointStrategy.planning?.({ itemsPerRound: 1 })).toEqual({ itemsPerRound: 1 });
    expect(jointStrategy.planning?.({ itemsPerRound: 0 })).toEqual({ itemsPerRound: null });
    expect(jointStrategy.describeConfig({ itemsPerRound: 0 })).toBe("Tur başına sınırsız öge");
  });

  it("is the only built-in strategy with planning", () => {
    expect(rotationStrategy.planning).toBeUndefined();
    expect(openStrategy.planning).toBeUndefined();
    expect(poolStrategy.planning).toBeUndefined();
  });

  it("fills past rounds through planning, not history (only rotation has that)", () => {
    expect(jointStrategy.history).toBeUndefined();
    expect(openStrategy.history).toBeUndefined();
    expect(poolStrategy.history).toBeUndefined();
  });
});

describe("config handling", () => {
  it("fills defaults and ignores invalid stored values", () => {
    expect(parseStoredConfig(rotationStrategy, { picksPerTurn: 3 })).toEqual({
      mode: "pairs",
      picksPerTurn: 3,
      requireAcceptance: true,
    });
    expect(parseStoredConfig(rotationStrategy, { mode: "chaos" })).toEqual(defaultConfig(rotationStrategy));
  });

  it("reads typed values from a submitted form", () => {
    const form = new FormData();
    form.set(configFieldName("pool", "selection"), "random");
    form.set(configFieldName("pool", "picksPerRound"), "2");
    const values = readConfigFromForm(getStrategy("pool"), form);
    expect(values).toEqual({ selection: "random", picksPerRound: 2, autoDraw: false });
    expect(poolStrategy.configSchema.parse(values)).toEqual({
      selection: "random",
      picksPerRound: 2,
      autoDraw: false,
      maxCandidatesPerUser: 0,
    });
  });
});
