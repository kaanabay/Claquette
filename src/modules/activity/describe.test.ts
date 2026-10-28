import { describe, expect, it } from "vitest";
import { describeActivity } from "./describe";

describe("describeActivity", () => {
  it("renders suggestions with and without a recipient", () => {
    expect(describeActivity("entry.suggested", { title: "Dune", recipientName: "Ayşe" })).toBe("Ayşe için “Dune” önerdi");
    expect(describeActivity("entry.suggested", { title: "Dune", recipientName: null })).toBe("gruba “Dune” önerdi");
    expect(describeActivity("entry.suggested", { title: "Dune", pool: true })).toBe("havuza “Dune” ekledi");
  });

  it("distinguishes automatic and manual state changes", () => {
    expect(describeActivity("entry.state_changed", { title: "Dune", to: "Tamamlandı", automatic: true }, false)).toBe(
      "“Dune” herkes bitirdiği için «Tamamlandı» oldu",
    );
    expect(describeActivity("entry.state_changed", { title: "Dune", to: "Kabul Edildi" })).toBe(
      "“Dune” ögesini «Kabul Edildi» olarak işaretledi",
    );
  });

  it("phrases pool draws by who triggered them", () => {
    expect(describeActivity("entry.selected", { title: "Dune", method: "votes" }, false)).toBe("“Dune” havuzdan seçildi");
    expect(describeActivity("entry.selected", { title: "Dune", method: "votes" }, true)).toBe("havuzdan “Dune” ögesini çekti");
  });

  it("names the round for planned and moved items", () => {
    expect(describeActivity("entry.planned", { title: "Stalker", round: "Kasım 2026" })).toBe(
      "“Stalker” ögesini «Kasım 2026» turuna ekledi",
    );
    expect(describeActivity("entry.planned", { title: "Stalker", round: "Kasım 2026", accepted: true })).toBe(
      "“Stalker” önerisini kabul edip «Kasım 2026» turuna ekledi",
    );
    expect(describeActivity("entry.moved", { title: "Stalker", round: "Aralık 2026" })).toBe(
      "“Stalker” ögesini «Aralık 2026» turuna taşıdı",
    );
    expect(describeActivity("entry.unplanned", { title: "Stalker" })).toBe("“Stalker” ögesini plandan çıkarıp önerilere aldı");
  });

  it("names notes added to a board", () => {
    expect(describeActivity("board.note_added", { title: "Yönetmen havuzu" })).toBe("panoya “Yönetmen havuzu” notunu ekledi");
    expect(describeActivity("board.note_added", { title: null })).toBe("panoya not ekledi");
  });

  it("keeps the title of a deleted item", () => {
    expect(describeActivity("entry.deleted", { title: "Stalker" })).toBe("“Stalker” ögesini listeden sildi");
  });

  it("speaks of shared lists", () => {
    expect(describeActivity("challenge.created", { title: "Auteur Sineması" })).toBe("“Auteur Sineması” ortak listesini oluşturdu");
    expect(describeActivity("challenge.status_changed", { status: "archived" })).toBe("listeyi arşivledi");
  });

  it("combines progress and rating", () => {
    expect(describeActivity("progress.updated", { title: "Dune", status: "completed", rating: 9 })).toBe(
      "“Dune” ögesini bitirdi · puanı 9/10",
    );
    expect(describeActivity("progress.updated", { title: "Dune", status: null, rating: 7 })).toBe("“Dune” için 7/10 puan verdi");
  });
});
