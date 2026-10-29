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
    expect(
      describeActivity("entry.state_changed", { title: "Dune", to: "Kabul Edildi", automatic: true, reopened: true }, false),
    ).toBe("“Dune” yeniden «Kabul Edildi» oldu");
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

  it("describes settings and member changes", () => {
    expect(describeActivity("group.updated", { name: "Pazar Sineması", renamedFrom: "Sinema" })).toBe("grubun adını “Pazar Sineması” yaptı");
    expect(describeActivity("group.updated", { name: "Pazar Sineması", renamedFrom: null })).toBe("grubun bilgilerini güncelledi");
    expect(describeActivity("member.role_changed", { name: "Ayşe Yılmaz", role: "admin" })).toBe("Ayşe Yılmaz adlı üyeyi yönetici yaptı");
    expect(describeActivity("member.role_changed", { name: "Ayşe Yılmaz", role: "member" })).toBe(
      "Ayşe Yılmaz adlı üyenin yöneticiliğini kaldırdı",
    );
    expect(describeActivity("member.removed", { name: "Deniz" })).toBe("Deniz adlı üyeyi gruptan çıkardı");
    expect(describeActivity("challenge.updated", { title: "Auteur Sineması", fields: ["başlık", "kural ayarları"] })).toBe(
      "“Auteur Sineması” listesinin ayarlarını değiştirdi (başlık, kural ayarları)",
    );
  });

  it("says who had finished an item put into a round that was over", () => {
    expect(describeActivity("entry.planned", { title: "Persona", round: "Mart 2026", finished: "all" })).toBe(
      "“Persona” ögesini «Mart 2026» turuna ekledi · herkes bitirmişti",
    );
    expect(describeActivity("entry.moved", { title: "Persona", round: "Mart 2026", finished: "me" })).toBe(
      "“Persona” ögesini «Mart 2026» turuna taşıdı · kendisi bitirmişti",
    );
    expect(describeActivity("entry.planned", { title: "Persona", round: "Mart 2026", finished: null })).toBe(
      "“Persona” ögesini «Mart 2026» turuna ekledi",
    );
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
