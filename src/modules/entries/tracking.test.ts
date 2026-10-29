import { describe, expect, it } from "vitest";
import type { ProgressStatus } from "./labels";
import {
  assigneesOf,
  finishedBy,
  listPeople,
  progressOutcome,
  roundTiming,
  stateAfterProgress,
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

  it("decides nothing when everyone gave up or nobody is assigned", () => {
    expect(progressOutcome(both, statuses({ kaan: "dropped", ali: "dropped" }))).toBeNull();
    expect(progressOutcome([], statuses({}))).toBeNull();
  });
});

describe("stateAfterProgress", () => {
  const base = { tracked: true, actorIsAssignee: true, actorWasSettled: false, actorIsSettled: true } as const;

  it("completes an accepted item when the last assignee finishes", () => {
    expect(stateAfterProgress({ ...base, category: "active", outcome: "done" })).toBe("done");
    expect(stateAfterProgress({ ...base, category: "pending", outcome: "done" })).toBe("done");
    expect(stateAfterProgress({ ...base, category: "active", outcome: "open" })).toBeNull();
  });

  it("never completes a suggestion waiting for a round, or a dropped item", () => {
    expect(stateAfterProgress({ ...base, tracked: false, category: "pending", outcome: "done" })).toBeNull();
    expect(stateAfterProgress({ ...base, category: "dropped", outcome: "done" })).toBeNull();
  });

  it("reopens a done item when an assignee takes back their 'finished'", () => {
    const tookBack = { ...base, actorWasSettled: true, actorIsSettled: false };
    expect(stateAfterProgress({ ...tookBack, category: "done", outcome: "open" })).toBe("active");
    expect(stateAfterProgress({ ...tookBack, actorIsAssignee: false, category: "done", outcome: "open" })).toBeNull();
  });

  it("leaves a completion set by hand alone when someone else only updates their progress", () => {
    expect(stateAfterProgress({ ...base, actorIsSettled: false, category: "done", outcome: "open" })).toBeNull();
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

  it("tracks only items in a round that the group took on", () => {
    expect(trackEntry({ category: "pending", timing: "current", people: [kaan] })).toBeNull();
    expect(trackEntry({ category: "dropped", timing: "past", people: [kaan] })).toBeNull();
    expect(trackEntry({ category: "active", timing: null, people: [kaan] })).toBeNull();
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
