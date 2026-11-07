import { describe, expect, it } from "vitest";
import { activityKind, canViewProfile, describeTypeCounts, inProgressLabel } from "./domain";

describe("canViewProfile", () => {
  const base = { viewerId: "kaan", personId: "ayse", sharedGroups: 0, viewerIsSiteAdmin: false };

  it("opens a profile to people who share a group, to the person and to the site admin", () => {
    expect(canViewProfile({ ...base, sharedGroups: 1 })).toBe(true);
    expect(canViewProfile({ ...base, personId: "kaan" })).toBe(true);
    expect(canViewProfile({ ...base, viewerIsSiteAdmin: true })).toBe(true);
  });

  it("keeps it from everyone else", () => {
    expect(canViewProfile(base)).toBe(false);
  });
});

describe("activityKind", () => {
  it("sorts what someone did into additions, finishing, ratings, notes and the rest", () => {
    expect(activityKind("entry.suggested", { pool: true })).toBe("added");
    expect(activityKind("entry.planned", {})).toBe("added");
    expect(activityKind("entry.recorded", {})).toBe("added");
    expect(activityKind("progress.updated", { status: "completed", rating: 8 })).toBe("finished");
    expect(activityKind("progress.updated", { status: null, rating: 8 })).toBe("rated");
    expect(activityKind("progress.updated", { status: "in_progress", rating: null })).toBe("other");
    expect(activityKind("progress.updated", { status: null, rating: null })).toBe("other");
    expect(activityKind("note.added", {})).toBe("note");
    expect(activityKind("board.note_added", {})).toBe("note");
    expect(activityKind("entry.off_round", {})).toBe("other");
  });
});

describe("labels", () => {
  it("says what someone is on in the third person", () => {
    expect(inProgressLabel("book")).toBe("Okuyor");
    expect(inProgressLabel("tv")).toBe("İzliyor");
    expect(inProgressLabel("other")).toBe("Devam ediyor");
  });

  it("counts by type in lower case", () => {
    expect(describeTypeCounts([{ label: "Film", count: 12 }, { label: "Kitap", count: 3 }])).toBe("12 film · 3 kitap");
  });
});
