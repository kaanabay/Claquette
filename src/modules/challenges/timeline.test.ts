import { describe, expect, it } from "vitest";
import { addBlockedReason, daysLeft } from "./timeline";

describe("addBlockedReason", () => {
  const base = { reason: "Şu an aktif bir tur yok.", today: "2026-10-23", startsOn: "2027-01-01" };

  it("explains that a list without planning opens with its first round", () => {
    expect(addBlockedReason({ ...base, isPlanning: false })).toBe(
      "Bu listenin kuralında ekleme tur sırasında yapılıyor; ilk tur 1 Ocak 2027 tarihinde başlıyor. Turları önceden doldurmak için liste “Birlikte belirliyoruz” kuralıyla kurulmalı.",
    );
  });

  it("keeps the strategy's own reason otherwise", () => {
    expect(addBlockedReason({ ...base, isPlanning: true })).toBe(base.reason);
    expect(addBlockedReason({ ...base, startsOn: "2026-10-01", isPlanning: false })).toBe(base.reason);
  });
});

describe("daysLeft", () => {
  it("counts down to the last day and hides past or open-ended rounds", () => {
    expect(daysLeft("2026-10-31", "2026-10-23")).toBe("8 gün kaldı");
    expect(daysLeft("2026-10-23", "2026-10-23")).toBe("son gün");
    expect(daysLeft("2026-10-22", "2026-10-23")).toBeNull();
    expect(daysLeft(null, "2026-10-23")).toBeNull();
  });
});
