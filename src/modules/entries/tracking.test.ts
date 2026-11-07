import { describe, expect, it } from "vitest";
import type { ProgressStatus } from "./labels";
import {
  assigneesOf,
  describeRoundSummary,
  everyoneGaveUp,
  finishedBy,
  isSettled,
  listPeople,
  progressOutcome,
  roundTiming,
  stateAfterProgress,
  summarizeRound,
  trackEntry,
  type TrackingPerson,
} from "./tracking";

const statuses = (map: Record<string, ProgressStatus>) => (userId: string) => map[userId] ?? null;

describe("roundTiming", () => {
  const october = { startsOn: "2026-10-01", endsOn: "2026-10-31", closedAt: null };

  it("places a round before, around or after today", () => {
    expect(roundTiming(october, "2026-09-30")).toBe("future");
    expect(roundTiming(october, "2026-10-01")).toBe("current");
    expect(roundTiming(october, "2026-10-31")).toBe("current");
    expect(roundTiming(october, "2026-11-01")).toBe("past");
  });

  it("treats a closed turn of an indefinite list as over, even on the day it closed", () => {
    expect(roundTiming({ startsOn: "2026-10-01", endsOn: null, closedAt: null }, "2027-05-01")).toBe("current");
    expect(roundTiming({ startsOn: "2026-10-01", endsOn: "2026-10-20", closedAt: new Date() }, "2026-10-20")).toBe("past");
  });
});

describe("assigneesOf", () => {
  const participants = [{ userId: "kaan" }, { userId: "ali" }];

  it("means a personal suggestion for its recipient, anything else for everyone taking part", () => {
    expect(assigneesOf("ali", participants)).toEqual(["ali"]);
    expect(assigneesOf(null, participants)).toEqual(["kaan", "ali"]);
  });
});

describe("progressOutcome", () => {
  const both = ["kaan", "ali"];

  it("is done once everyone finished it", () => {
    expect(progressOutcome(both, statuses({ kaan: "completed", ali: "completed" }))).toBe("done");
  });

  it("stays open while someone is still to go", () => {
    expect(progressOutcome(both, statuses({ kaan: "completed" }))).toBe("open");
    expect(progressOutcome(both, statuses({ kaan: "completed", ali: "in_progress" }))).toBe("open");
  });

  it("doesn't wait for someone who set it aside", () => {
    expect(progressOutcome(both, statuses({ kaan: "completed", ali: "dropped" }))).toBe("done");
  });

  it("doesn't wait for someone who passed on it (“İzlemeyeceğim”)", () => {
    expect(progressOutcome(both, statuses({ kaan: "completed", ali: "skipped" }))).toBe("done");
  });

  it("decides nothing when everyone gave up or nobody is assigned", () => {
    expect(progressOutcome(both, statuses({ kaan: "dropped", ali: "dropped" }))).toBeNull();
    expect(progressOutcome(both, statuses({ kaan: "skipped", ali: "dropped" }))).toBeNull();
    expect(progressOutcome([], statuses({}))).toBeNull();
  });
});

describe("isSettled and everyoneGaveUp", () => {
  const both = ["kaan", "ali"];

  it("counts finishing, setting aside and passing as settled", () => {
    expect(["completed", "dropped", "skipped"].every((status) => isSettled(status as ProgressStatus))).toBe(true);
    expect(isSettled("in_progress")).toBe(false);
    expect(isSettled(null)).toBe(false);
  });

  it("is true only when everyone is done with it and nobody finished it", () => {
    expect(everyoneGaveUp(both, statuses({ kaan: "skipped", ali: "dropped" }))).toBe(true);
    expect(everyoneGaveUp(both, statuses({ kaan: "skipped", ali: "completed" }))).toBe(false);
    expect(everyoneGaveUp(both, statuses({ kaan: "skipped" }))).toBe(false);
    expect(everyoneGaveUp([], statuses({}))).toBe(false);
  });
});

describe("stateAfterProgress", () => {
  const base = {
    place: "round",
    planning: false,
    pool: false,
    gaveUp: false,
    actorIsAssignee: true,
    actorWasSettled: false,
    actorIsSettled: true,
  } as const;

  it("completes an accepted item when the last assignee finishes", () => {
    expect(stateAfterProgress({ ...base, category: "active", outcome: "done" })).toBe("done");
    expect(stateAfterProgress({ ...base, category: "pending", outcome: "done" })).toBe("done");
    expect(stateAfterProgress({ ...base, category: "active", outcome: "open" })).toBeNull();
  });

  it("never completes a planning list's suggestion waiting for a round, or a dropped item", () => {
    expect(stateAfterProgress({ ...base, place: "waiting", planning: true, category: "pending", outcome: "done" })).toBeNull();
    expect(stateAfterProgress({ ...base, place: "dropped", category: "dropped", outcome: "done" })).toBeNull();
  });

  it("reopens a done item when an assignee takes back their 'finished'", () => {
    const tookBack = { ...base, actorWasSettled: true, actorIsSettled: false };
    expect(stateAfterProgress({ ...tookBack, category: "done", outcome: "open" })).toBe("active");
    expect(stateAfterProgress({ ...tookBack, place: "off", category: "done", outcome: "open" })).toBe("active");
    expect(stateAfterProgress({ ...tookBack, actorIsAssignee: false, category: "done", outcome: "open" })).toBeNull();
  });

  it("leaves a completion set by hand alone when someone else only updates their progress", () => {
    expect(stateAfterProgress({ ...base, actorIsSettled: false, category: "done", outcome: "open" })).toBeNull();
  });

  it("tracks a “Tur dışı” item like a round's, and drops it once nobody will finish it", () => {
    const off = { ...base, place: "off", category: "active" } as const;
    expect(stateAfterProgress({ ...off, outcome: "done" })).toBe("done");
    expect(stateAfterProgress({ ...off, outcome: "open" })).toBeNull();
    expect(stateAfterProgress({ ...off, outcome: null, gaveUp: true })).toBe("dropped");
    // In a round the group decides those by hand.
    expect(stateAfterProgress({ ...base, category: "active", outcome: null, gaveUp: true })).toBeNull();
  });

  it("takes a pool candidate someone finished alone out of the pool", () => {
    const candidate = { ...base, place: "waiting", pool: true, category: "pending" } as const;
    expect(stateAfterProgress({ ...candidate, outcome: "open" })).toBe("active");
    expect(stateAfterProgress({ ...candidate, outcome: "done" })).toBe("done");
    expect(stateAfterProgress({ ...candidate, outcome: null, gaveUp: true })).toBe("dropped");
    // Starting it, someone else's change, or a planning list's suggestion leave it waiting.
    expect(stateAfterProgress({ ...candidate, actorIsSettled: false, outcome: "open" })).toBeNull();
    expect(stateAfterProgress({ ...candidate, actorIsAssignee: false, outcome: "open" })).toBeNull();
    expect(stateAfterProgress({ ...candidate, pool: false, planning: true, outcome: "open" })).toBeNull();
  });
});

describe("finishedBy", () => {
  it("marks everyone, only the person adding it, or nobody", () => {
    expect(finishedBy("all", ["kaan", "ali"], "kaan")).toEqual(["kaan", "ali"]);
    expect(finishedBy("me", ["kaan", "ali"], "kaan")).toEqual(["kaan"]);
    expect(finishedBy("none", ["kaan", "ali"], "kaan")).toEqual([]);
  });
});

describe("trackEntry", () => {
  const kaan: TrackingPerson = { id: "kaan", name: "Kaan Abay", status: "completed" };
  const ali: TrackingPerson = { id: "ali", name: "Ali Can", status: null };

  it("flags an accepted item whose round is over while someone is still to go", () => {
    const tracking = trackEntry({ category: "active", timing: "past", people: [kaan, ali] });
    expect(tracking?.overdue).toBe(true);
    expect(tracking?.waiting.map((person) => person.id)).toEqual(["ali"]);
  });

  it("doesn't flag the current round, a finished item or someone who set it aside", () => {
    expect(trackEntry({ category: "active", timing: "current", people: [kaan, ali] })?.overdue).toBe(false);
    expect(trackEntry({ category: "done", timing: "past", people: [kaan, ali] })).toMatchObject({ overdue: false, waiting: [] });
    expect(trackEntry({ category: "active", timing: "past", people: [kaan, { ...ali, status: "dropped" }] })?.overdue).toBe(false);
  });

  it("tracks only items the group took on: in a round, or “Tur dışı”", () => {
    expect(trackEntry({ category: "pending", timing: "current", people: [kaan] })).toBeNull();
    expect(trackEntry({ category: "dropped", timing: "past", people: [kaan] })).toBeNull();
    expect(trackEntry({ category: "active", timing: null, people: [kaan] })).toBeNull();
  });

  it("tracks a “Tur dışı” item without a date: never overdue", () => {
    const tracking = trackEntry({ category: "active", timing: "off", people: [kaan, ali] });
    expect(tracking).toMatchObject({ timing: "off", overdue: false });
    expect(tracking?.waiting.map((person) => person.id)).toEqual(["ali"]);
  });
});

describe("listPeople", () => {
  const people = [
    { id: "ali", name: "Ali Can" },
    { id: "kaan", name: "Kaan Abay" },
    { id: "ayse", name: "Ayşe" },
    { id: "deniz", name: "Deniz" },
  ];

  it("names people by first name, the viewer first as 'sen'", () => {
    expect(listPeople(people.slice(0, 1), "kaan")).toBe("Ali");
    expect(listPeople(people.slice(0, 2), "kaan")).toBe("sen ve Ali");
    expect(listPeople(people.slice(0, 3), "kaan")).toBe("sen, Ali ve Ayşe");
    expect(listPeople(people, "kaan")).toBe("sen, Ali ve 2 kişi daha");
  });
});

describe("summarizeRound", () => {
  const kaan: TrackingPerson = { id: "kaan", name: "Kaan Abay", status: null };
  const ali: TrackingPerson = { id: "ali", name: "Ali Can", status: null };
  const waitingFor = (...people: TrackingPerson[]) => ({ people, waiting: people, timing: "past" as const, overdue: true });

  it("counts done items and names everyone still to go once", () => {
    const summary = summarizeRound([
      { category: "done", tracking: { people: [kaan, ali], waiting: [], timing: "past", overdue: false } },
      { category: "active", tracking: waitingFor(ali) },
      { category: "active", tracking: waitingFor(kaan, ali) },
    ]);
    expect(summary.done).toBe(1);
    expect(summary.total).toBe(3);
    expect(summary.waiting.map((person) => person.id)).toEqual(["ali", "kaan"]);
  });

  it("reads as “2/2 bitti”, adding who is still to go only once the round is over", () => {
    const done = { category: "done" as const, tracking: null };
    const open = { category: "active" as const, tracking: waitingFor(ali) };
    expect(describeRoundSummary(summarizeRound([done, done]), "kaan", true)).toBe("2/2 bitti");
    expect(describeRoundSummary(summarizeRound([done, open]), "kaan", true)).toBe("1/2 bitti · bitirmeyen: Ali");
    expect(describeRoundSummary(summarizeRound([done, open]), "ali", true)).toBe("1/2 bitti · bitirmeyen: sen");
    expect(describeRoundSummary(summarizeRound([done, open]), "kaan", false)).toBe("1/2 bitti");
    expect(describeRoundSummary(summarizeRound([]), "kaan", true)).toBeNull();
  });
});
