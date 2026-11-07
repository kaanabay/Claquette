import { describe, expect, it } from "vitest";
import { finishedChoices, groupAudience, offRoundChoices, progressLabel } from "./labels";

describe("finishedChoices", () => {
  const labels = (choices: ReturnType<typeof finishedChoices>) => choices.map((choice) => `${choice.value}:${choice.label}`);

  it("asks a group who finished it, “everyone” first", () => {
    expect(labels(finishedChoices(groupAudience(2)))).toEqual(["all:Hepimiz bitirdik", "me:Sadece ben bitirdim", "none:Henüz bitmedi"]);
  });

  it("asks a list of one, or the person it was meant for, in the first person", () => {
    expect(groupAudience(1)).toEqual({ kind: "me" });
    expect(labels(finishedChoices({ kind: "me" }))).toEqual(["all:Bitirdim", "none:Henüz bitmedi"]);
  });

  it("asks about someone else by first name, never offering “only me”", () => {
    expect(labels(finishedChoices({ kind: "person", name: "Ayşe Yılmaz" }))).toEqual(["all:Ayşe bitirdi", "none:Henüz bitirmedi"]);
  });
});

describe("progressLabel", () => {
  it("says “won't” with the verb of the media type", () => {
    expect(progressLabel("skipped", "movie")).toBe("İzlemeyeceğim");
    expect(progressLabel("skipped", "tv")).toBe("İzlemeyeceğim");
    expect(progressLabel("skipped", "book")).toBe("Okumayacağım");
    expect(progressLabel("skipped", "other")).toBe("Pas geçiyorum");
    expect(progressLabel("dropped", "book")).toBe("Yarım bıraktım");
  });
});

describe("offRoundChoices", () => {
  const labels = (choices: ReturnType<typeof offRoundChoices>) => choices.map((choice) => `${choice.value}:${choice.label}`);

  it("asks a group who finished a “Tur dışı” item, “only me” first", () => {
    expect(labels(offRoundChoices({ participantCount: 2, credited: { isViewer: true, name: "Kaan Abay" } }))).toEqual([
      "me:Sadece ben bitirdim",
      "all:Hepimiz bitirdik",
      "none:Henüz kimse bitirmedi",
    ]);
  });

  it("asks about the person a group admin adds it for, by first name", () => {
    expect(labels(offRoundChoices({ participantCount: 2, credited: { isViewer: false, name: "Ayşe Yılmaz" } }))[0]).toBe(
      "me:Sadece Ayşe bitirdi",
    );
  });

  it("asks a list of one in the first person", () => {
    expect(labels(offRoundChoices({ participantCount: 1, credited: { isViewer: true, name: "Kaan" } }))).toEqual([
      "all:Bitirdim",
      "none:Henüz bitirmedim",
    ]);
  });
});
