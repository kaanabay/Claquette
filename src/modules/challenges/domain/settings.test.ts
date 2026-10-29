import { describe, expect, it } from "vitest";
import { confirmationKey, planSettingsChange, type ChallengeSettings, type SettingsFacts } from "./settings";
import { getStrategy } from "./strategies";

const auteur: ChallengeSettings = {
  title: "Auteur Sineması",
  description: null,
  mediaTypes: ["movie"],
  cadenceUnit: "month",
  cadenceInterval: 1,
  startsOn: "2026-01-01",
  endsOn: "2026-12-31",
  strategy: "joint",
  strategyConfig: { itemsPerRound: 1 },
  workflowId: "default",
  participants: ["kaan", "ayse"],
};

const facts: SettingsFacts = {
  entryCount: 3,
  rounds: [
    { index: 2, label: "Mart 2026", count: 1 },
    { index: 9, label: "Ekim 2026", count: 2 },
  ],
  lastFilledRound: { index: 10, label: "Kasım 2026" },
  typeCounts: { movie: 3 },
  typeLabels: { movie: "Film", book: "Kitap" },
  names: { kaan: "Kaan", ayse: "Ayşe", deniz: "Deniz" },
  strategyLabels: { joint: "Birlikte belirliyoruz", pool: "Ortak havuz" },
  workflowNames: { default: "Varsayılan", club: "Kulüp" },
};

const plan = (after: Partial<ChallengeSettings>, overrides: Partial<SettingsFacts> = {}) =>
  planSettingsChange(auteur, { ...auteur, ...after }, { ...facts, ...overrides }, getStrategy((after.strategy ?? auteur.strategy) as string));
const levels = (changes: { level: string }[]) => changes.map((change) => change.level);

describe("planSettingsChange", () => {
  it("lets names and descriptions change freely", () => {
    expect(plan({ title: "Yönetmenler", description: "Ayda bir" })).toEqual([
      { field: "başlık", level: "free", message: "Başlık “Yönetmenler” olur." },
      { field: "açıklama", level: "free", message: "Açıklama değişir." },
    ]);
    expect(plan({})).toEqual([]);
  });

  it("lifts or raises the items-per-round limit freely", () => {
    expect(plan({ strategyConfig: { itemsPerRound: 0 } })).toEqual([
      { field: "kural ayarları", level: "free", message: "Turlara sınırsız öge eklenebilir." },
    ]);
    expect(levels(plan({ strategyConfig: { itemsPerRound: 3 } }))).toEqual(["free"]);
  });

  it("asks before a lower limit, naming the rounds above it and keeping their items", () => {
    const [change] = plan({ strategyConfig: { itemsPerRound: 1 } }, { rounds: facts.rounds });
    expect(change).toBeUndefined(); // unchanged
    const lowered = planSettingsChange(
      { ...auteur, strategyConfig: { itemsPerRound: 0 } },
      { ...auteur, strategyConfig: { itemsPerRound: 1 } },
      facts,
      getStrategy("joint"),
    );
    expect(lowered).toHaveLength(1);
    expect(lowered[0].level).toBe("confirm");
    expect(lowered[0].message).toContain("«Ekim 2026» (2 öge)");
    expect(lowered[0].message).toContain("ögeler olduğu gibi kalır");
  });

  it("asks before leaving out a media type that items use", () => {
    expect(plan({ mediaTypes: ["book"] })).toEqual([
      { field: "içerik türleri", level: "confirm", message: "“Film” türünde 3 öge var; yerinde kalırlar, bu türde yeni öge eklenemez." },
    ]);
    expect(plan({ mediaTypes: [] })).toEqual([{ field: "içerik türleri", level: "free", message: "Tüm içerik türleri kabul edilir." }]);
    expect(levels(plan({ mediaTypes: ["movie", "book"] }))).toEqual(["free"]);
  });

  it("blocks an end date before a filled round, asks before dropping empty ones", () => {
    expect(levels(plan({ endsOn: "2026-10-31" }))).toEqual(["blocked"]);
    expect(plan({ endsOn: "2026-10-31" })[0].message).toContain("«Kasım 2026» turunda öge var");
    expect(levels(plan({ endsOn: "2026-11-30" }))).toEqual(["confirm"]);
    expect(levels(plan({ endsOn: "2027-06-30" }))).toEqual(["free"]);
    expect(levels(plan({ endsOn: null }))).toEqual(["free"]);
  });

  it("keeps cadence, start, rule and workflow fixed once the list holds items", () => {
    expect(levels(plan({ cadenceInterval: 3 }))).toEqual(["blocked"]);
    expect(levels(plan({ startsOn: "2026-02-01" }))).toEqual(["blocked"]);
    expect(levels(plan({ strategy: "pool", strategyConfig: {} }))).toEqual(["blocked"]);
    expect(levels(plan({ workflowId: "club" }))).toEqual(["blocked"]);
  });

  it("lets an empty list change its timing, rule and workflow", () => {
    const empty = { entryCount: 0, rounds: [], lastFilledRound: null, typeCounts: {} };
    expect(levels(plan({ cadenceInterval: 3 }, empty))).toEqual(["free"]);
    expect(levels(plan({ strategy: "pool", strategyConfig: {} }, empty))).toEqual(["free"]);
    expect(levels(plan({ workflowId: "club" }, empty))).toEqual(["free"]);
  });

  it("asks before someone leaves, never lets the list go empty", () => {
    expect(plan({ participants: ["kaan", "ayse", "deniz"] })).toEqual([
      { field: "katılımcılar", level: "free", message: "Deniz listeye katılır." },
    ]);
    expect(levels(plan({ participants: ["kaan"] }))).toEqual(["confirm"]);
    expect(plan({ participants: ["kaan"] })[0].message).toContain("Ayşe listeden ayrılır");
    expect(levels(plan({ participants: [] }))).toEqual(["blocked"]);
  });
});

describe("confirmationKey", () => {
  it("changes when the consequences change, and ignores free changes", () => {
    const a = plan({ participants: ["kaan"] });
    const b = plan({ participants: ["ayse"] });
    expect(confirmationKey(a)).not.toBe(confirmationKey(b));
    expect(confirmationKey([...a, ...plan({ title: "X" })])).toBe(confirmationKey(a));
  });
});
