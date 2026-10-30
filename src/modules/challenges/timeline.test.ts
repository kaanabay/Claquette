import { describe, expect, it } from "vitest";
import { addBlockedReason, daysLeft, endedAgo, startsIn } from "./timeline";

describe("addBlockedReason", () => {
  const base = { reason: "Şu an aktif bir tur yok.", today: "2026-10-23", startsOn: "2027-01-01" };

  it("explains that an indefinite list opens with its first turn", () => {
    expect(addBlockedReason({ ...base, opensEarly: false })).toBe(
      "Süresiz listede turlar başladıkça açılır; ilk tur 1 Ocak 2027 tarihinde başlıyor. Turları önceden doldurmak için listeye bir sıklık ver.",
    );
  });

  it("keeps the strategy's own reason otherwise", () => {
    expect(addBlockedReason({ ...base, opensEarly: true })).toBe(base.reason);
    expect(addBlockedReason({ ...base, startsOn: "2026-10-01", opensEarly: false })).toBe(base.reason);
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

describe("startsIn", () => {
  it("counts the days until a round starts", () => {
    expect(startsIn("2026-11-01", "2026-10-31")).toBe("yarın başlıyor");
    expect(startsIn("2026-11-01", "2026-10-23")).toBe("9 gün sonra başlıyor");
    expect(startsIn("2026-11-01", "2026-11-01")).toBeNull();
  });
});

describe("endedAgo", () => {
  it("counts the days since a round ended", () => {
    expect(endedAgo("2026-10-31", "2026-11-01")).toBe("dün bitti");
    expect(endedAgo("2026-10-31", "2026-11-12")).toBe("12 gün önce bitti");
    expect(endedAgo("2026-11-01", "2026-11-01")).toBe("bugün bitti");
    expect(endedAgo("2026-11-02", "2026-11-01")).toBeNull();
    expect(endedAgo(null, "2026-11-01")).toBeNull();
  });
});
