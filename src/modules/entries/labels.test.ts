import { describe, expect, it } from "vitest";
import { finishedChoices, groupAudience } from "./labels";

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
