import type { ProgressStatus } from "@/modules/entries/labels";

const quoted = (value: unknown) => (typeof value === "string" && value ? `“${value}”` : "bir öge");

const STATUS_PHRASES: Record<ProgressStatus, string> = {
  planned: "ögesini listesine ekledi",
  in_progress: "ögesine başladı",
  completed: "ögesini bitirdi",
  dropped: "ögesini yarım bıraktı",
};

// Items put into a round that was already over carry who had finished them.
const FINISHED_SUFFIX: Record<string, string> = { all: " · herkes bitirmişti", me: " · kendisi bitirmişti" };
const finishedSuffix = (value: unknown) => FINISHED_SUFFIX[String(value)] ?? "";

/** Turkish sentence (without the actor's name) for an activity row. */
export function describeActivity(type: string, data: Record<string, unknown>, hasActor = true): string {
  const title = quoted(data.title);
  switch (type) {
    case "group.created":
      return "grubu oluşturdu";
    case "group.updated":
      return typeof data.renamedFrom === "string" ? `grubun adını ${quoted(data.name)} yaptı` : "grubun bilgilerini güncelledi";
    case "member.joined":
      return "gruba katıldı";
    case "member.role_changed":
      return data.role === "admin" ? `${String(data.name)} adlı üyeyi yönetici yaptı` : `${String(data.name)} adlı üyenin yöneticiliğini kaldırdı`;
    case "member.removed":
      return `${String(data.name)} adlı üyeyi gruptan çıkardı`;
    case "challenge.created":
      return `${quoted(data.title)} ortak listesini oluşturdu`;
    case "challenge.updated": {
      const fields = Array.isArray(data.fields) ? data.fields.join(", ") : "";
      return `${quoted(data.title)} listesinin ayarlarını değiştirdi${fields ? ` (${fields})` : ""}`;
    }
    case "challenge.joined":
      return "listeye katıldı";
    case "challenge.left":
      return "listeden ayrıldı";
    case "challenge.status_changed":
      return data.status === "paused"
        ? "listeyi duraklattı"
        : data.status === "archived"
          ? "listeyi arşivledi"
          : "listeyi yeniden başlattı";
    case "round.started":
      return `${Number(data.index) + 1}. turu başlattı`;
    case "entry.suggested":
      if (data.pool) return `havuza ${title} ekledi`;
      return typeof data.recipientName === "string" ? `${data.recipientName} için ${title} önerdi` : `gruba ${title} önerdi`;
    case "entry.state_changed":
      if (data.reopened) return `${title} yeniden «${String(data.to)}» oldu`;
      return data.automatic
        ? `${title} herkes bitirdiği için «${String(data.to)}» oldu`
        : `${title} ögesini «${String(data.to)}» olarak işaretledi`;
    case "entry.selected":
      if (data.method === "manual") return `${title} ögesini bu tura seçti`;
      return hasActor ? `havuzdan ${title} ögesini çekti` : `${title} havuzdan seçildi`;
    case "entry.planned":
      return (
        (data.accepted
          ? `${title} önerisini kabul edip «${String(data.round)}» turuna ekledi`
          : `${title} ögesini «${String(data.round)}» turuna ekledi`) + finishedSuffix(data.finished)
      );
    case "entry.recorded": {
      // A pick filled in afterwards: whose it was and for whom.
      const recipient = typeof data.recipient === "string" ? data.recipient : null;
      const finished = data.finished === "all" && recipient ? ` · ${recipient} bitirmişti` : finishedSuffix(data.finished);
      return `«${String(data.round)}» turuna ${title} ekledi (${String(data.picker)} → ${recipient ?? "grup"})${finished}`;
    }
    case "entry.moved":
      return `${title} ögesini «${String(data.round)}» turuna taşıdı${finishedSuffix(data.finished)}`;
    case "entry.unplanned":
      return `${title} ögesini plandan çıkarıp önerilere aldı`;
    case "entry.deleted":
      return `${title} ögesini listeden sildi`;
    case "progress.updated": {
      const status = data.status as ProgressStatus | null;
      const rating = typeof data.rating === "number" ? `${data.rating}/10` : null;
      if (status && rating) return `${title} ${STATUS_PHRASES[status]} · puanı ${rating}`;
      if (status) return `${title} ${STATUS_PHRASES[status]}`;
      if (rating) return `${title} için ${rating} puan verdi`;
      return `${title} için puanını kaldırdı`;
    }
    case "note.added":
      return `${title} için not yazdı`;
    case "board.note_added":
      return typeof data.title === "string" && data.title ? `panoya “${data.title}” notunu ekledi` : "panoya not ekledi";
    case "workflow.created":
      return `${quoted(data.name)} durum akışını oluşturdu`;
    default:
      return "bir işlem yaptı";
  }
}
