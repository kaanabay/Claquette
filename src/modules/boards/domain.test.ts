import { describe, expect, it } from "vitest";
import { canDeleteNote, checklistCounts, linkify, parseNote, setLineChecked, toggleChecklist } from "./domain";

describe("parseNote", () => {
  it("reads bracket and box checklists, keeps other lines as text", () => {
    expect(parseNote("Yönetmenler\n[ ] Bergman\n- [x] Varda\n☐ Ozu\n☑ Tarkovski\nnot: sırayla")).toEqual([
      { kind: "text", text: "Yönetmenler" },
      { kind: "check", checked: false, text: "Bergman" },
      { kind: "check", checked: true, text: "Varda" },
      { kind: "check", checked: false, text: "Ozu" },
      { kind: "check", checked: true, text: "Tarkovski" },
      { kind: "text", text: "not: sırayla" },
    ]);
  });

  it("counts ticked items", () => {
    expect(checklistCounts(parseNote("[x] a\n[ ] b\n[X] c\nd"))).toEqual({ done: 2, total: 3 });
  });
});

describe("setLineChecked", () => {
  const body = "Yönetmenler\n☐ Bergman\n[ ] Varda";

  it("ticks a line and writes it in the bracket form", () => {
    expect(setLineChecked(body, 1, "Bergman", true)).toBe("Yönetmenler\n[x] Bergman\n[ ] Varda");
    expect(setLineChecked("[x] Varda", 0, "Varda", false)).toBe("[ ] Varda");
  });

  it("refuses when the line moved or changed meanwhile", () => {
    expect(setLineChecked(body, 2, "Bergman", true)).toBeNull();
    expect(setLineChecked(body, 0, "Yönetmenler", true)).toBeNull();
    expect(setLineChecked(body, 9, "Bergman", true)).toBeNull();
  });
});

describe("toggleChecklist", () => {
  it("turns lines into a checklist and back, skipping blank lines", () => {
    expect(toggleChecklist("Bergman\n\n  Varda ")).toBe("[ ] Bergman\n\n[ ] Varda");
    expect(toggleChecklist("[ ] Bergman\n[x] Varda")).toBe("Bergman\nVarda");
  });

  it("completes a half-checklist (pasted) without losing its ticks", () => {
    expect(toggleChecklist("☐ Bergman\n☑ Tarkovski\nVarda")).toBe("[ ] Bergman\n[x] Tarkovski\n[ ] Varda");
  });
});

describe("linkify", () => {
  it("finds links and leaves trailing punctuation out", () => {
    expect(linkify("Liste: https://letterboxd.com/x/list/auteurs/, bakalım.")).toEqual([
      { text: "Liste: " },
      { text: "https://letterboxd.com/x/list/auteurs/", href: "https://letterboxd.com/x/list/auteurs/" },
      { text: ", bakalım." },
    ]);
    expect(linkify("bağlantısız")).toEqual([{ text: "bağlantısız" }]);
  });
});

describe("canDeleteNote", () => {
  it("lets the author and the board's managers delete", () => {
    expect(canDeleteNote({ actorId: "a", createdBy: "a", canManage: false })).toBe(true);
    expect(canDeleteNote({ actorId: "b", createdBy: "a", canManage: false })).toBe(false);
    expect(canDeleteNote({ actorId: "b", createdBy: null, canManage: true })).toBe(true);
  });
});
