import { describe, expect, it } from "vitest";
import type { RoundTiming } from "@/modules/entries/tracking";
import { groupAssigned } from "./assigned";

const card = (
  id: string,
  timing: RoundTiming,
  round: { challengeId?: string; index: number; startsOn: string; endsOn: string | null },
  waiting: string[] = ["kaan"],
) => ({
  id,
  challengeId: round.challengeId ?? "auteur",
  roundIndex: round.index,
  roundStartsOn: round.startsOn,
  roundEndsOn: round.endsOn,
  viewerId: "kaan",
  tracking: { timing, waiting: waiting.map((personId) => ({ id: personId })) },
});

const september = { index: 8, startsOn: "2026-09-01", endsOn: "2026-09-30" };
const october = { index: 9, startsOn: "2026-10-01", endsOn: "2026-10-31" };
const november = { index: 10, startsOn: "2026-11-01", endsOn: "2026-11-30" };
const december = { index: 11, startsOn: "2026-12-01", endsOn: "2026-12-31" };
const ids = (cards: { id: string }[]) => cards.map((item) => item.id);

describe("groupAssigned", () => {
  it("splits what the viewer still has to finish by where its round stands", () => {
    const groups = groupAssigned([
      card("ordet", "past", september),
      card("stalker", "current", october),
      card("vampyr", "future", november),
    ]);
    expect(ids(groups.overdue)).toEqual(["ordet"]);
    expect(ids(groups.current)).toEqual(["stalker"]);
    expect(ids(groups.upcoming)).toEqual(["vampyr"]);
  });

  it("leaves out what the viewer finished and what isn't tracked", () => {
    const groups = groupAssigned([
      card("finished", "past", september, ["ali"]),
      { ...card("suggestion", "current", october), tracking: null },
    ]);
    expect([...groups.overdue, ...groups.current, ...groups.upcoming]).toEqual([]);
  });

  it("shows only each list's next round among the upcoming ones", () => {
    const groups = groupAssigned([
      card("november", "future", november),
      card("december", "future", december),
      card("q1", "future", { challengeId: "books", index: 0, startsOn: "2027-01-01", endsOn: "2027-03-31" }),
    ]);
    expect(ids(groups.upcoming)).toEqual(["november", "q1"]);
  });

  it("puts the oldest overdue and the soonest ending first, open-ended turns last", () => {
    const groups = groupAssigned([
      card("august", "past", { index: 7, startsOn: "2026-08-01", endsOn: "2026-08-31" }),
      card("open", "current", { challengeId: "pool", index: 2, startsOn: "2026-10-10", endsOn: null }),
      card("september", "past", september),
      card("october", "current", october),
    ]);
    expect(ids(groups.overdue)).toEqual(["august", "september"]);
    expect(ids(groups.current)).toEqual(["october", "open"]);
  });
});
