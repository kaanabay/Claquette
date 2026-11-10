import { describe, expect, it } from "vitest";
import { badgeLabel, describeNotification, isNotifiable, notificationHref } from "./domain";

describe("isNotifiable", () => {
  it("passes on what others did with items, notes and lists", () => {
    expect(isNotifiable("entry.suggested", { title: "Dune" })).toBe(true);
    expect(isNotifiable("note.added", {})).toBe(true);
    expect(isNotifiable("board.note_added", {})).toBe(true);
    expect(isNotifiable("round.started", { index: 2 })).toBe(true);
    expect(isNotifiable("member.joined", {})).toBe(true);
  });

  it("doesn't tell people what the app did because of their own change", () => {
    const completed = { title: "Dune", to: "Tamamlandı", automatic: true, by: "kaan" };
    expect(isNotifiable("entry.state_changed", completed, "kaan")).toBe(false);
    expect(isNotifiable("entry.state_changed", completed, "ayse")).toBe(true);
  });

  it("keeps quiet about settings and housekeeping", () => {
    expect(isNotifiable("challenge.updated", {})).toBe(false);
    expect(isNotifiable("workflow.created", {})).toBe(false);
    expect(isNotifiable("member.role_changed", {})).toBe(false);
  });

  it("tells finishing, giving up, passing and ratings, not starting", () => {
    expect(isNotifiable("progress.updated", { status: "completed", rating: null })).toBe(true);
    expect(isNotifiable("progress.updated", { status: "skipped", rating: null })).toBe(true);
    expect(isNotifiable("progress.updated", { status: "dropped", rating: null })).toBe(true);
    expect(isNotifiable("progress.updated", { status: null, rating: 8 })).toBe(true);
    expect(isNotifiable("progress.updated", { status: "in_progress", rating: null })).toBe(false);
    expect(isNotifiable("progress.updated", { status: "planned", rating: null })).toBe(false);
    expect(isNotifiable("progress.updated", { status: null, rating: null })).toBe(false);
  });
});

describe("describeNotification", () => {
  it("names the person by first name and says what they did", () => {
    expect(
      describeNotification({ type: "progress.updated", data: { title: "Dune", status: "completed" }, actorName: "Ayşe Yılmaz", forViewer: false }),
    ).toEqual({ actor: "Ayşe", text: "“Dune” ögesini bitirdi" });
  });

  it("speaks to the viewer about a suggestion meant for them", () => {
    expect(
      describeNotification({ type: "entry.suggested", data: { title: "Inception", recipientName: "Kaan" }, actorName: "Ayşe", forViewer: true }),
    ).toEqual({ actor: "Ayşe", text: "sana “Inception” önerdi" });
  });

  it("writes what the app did by itself as a sentence of its own", () => {
    expect(
      describeNotification({
        type: "entry.state_changed",
        data: { title: "Dune", to: "Tamamlandı", automatic: true },
        actorName: null,
        forViewer: false,
      }),
    ).toEqual({ actor: null, text: "“Dune” herkes bitirdiği için «Tamamlandı» oldu" });
  });
});

describe("notificationHref and badgeLabel", () => {
  it("leads to the item, else the list, else the group", () => {
    expect(notificationHref({ entryId: "e", challengeId: "c", groupId: "g" })).toBe("/entries/e");
    expect(notificationHref({ entryId: null, challengeId: "c", groupId: "g" })).toBe("/challenges/c");
    expect(notificationHref({ entryId: null, challengeId: null, groupId: "g" })).toBe("/groups/g");
  });

  it("caps the badge at 9+", () => {
    expect(badgeLabel(3)).toBe("3");
    expect(badgeLabel(12)).toBe("9+");
  });
});
