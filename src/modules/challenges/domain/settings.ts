// Changing a list's settings after it is in use (pure). Every changed field gets a level:
// "free" applies at once, "confirm" is shown with its consequences first, "blocked" can't be done.
// The rule behind all of them: a settings change never deletes or moves items. What would need
// that (a new cadence while rounds hold items, an end date before a filled round) is blocked, and
// a stricter limit leaves the rounds above it as they are.

import { formatDate } from "@/lib/dates";
import { isTimeBased, type CadenceUnit } from "./cadence";
import { lastRoundIndex } from "./plan";
import type { AnyStrategy, ChangeLevel, RoundFill } from "./strategies";

export type ChallengeSettings = {
  title: string;
  description: string | null;
  /** Allowed media types; empty = any. */
  mediaTypes: string[];
  cadenceUnit: CadenceUnit;
  cadenceInterval: number;
  startsOn: string;
  endsOn: string | null;
  strategy: string;
  /** Parsed by the strategy's schema (defaults filled in), so values compare fairly. */
  strategyConfig: Record<string, unknown>;
  workflowId: string;
  /** Active participants. */
  participants: string[];
};

export type SettingsFacts = {
  /** Every item in the list, whatever its state. */
  entryCount: number;
  /** Items in play per round. */
  rounds: RoundFill[];
  /** The last round holding any item, dropped ones included. */
  lastFilledRound: { index: number; label: string } | null;
  /** Items in play per media type. */
  typeCounts: Record<string, number>;
  typeLabels: Record<string, string>;
  /** Names of the group's members (and anyone taking part). */
  names: Record<string, string>;
  strategyLabels: Record<string, string>;
  workflowNames: Record<string, string>;
};

export type SettingsChange = { field: string; level: ChangeLevel; message: string };

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((item) => b.includes(item));

function sameConfig(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => Object.is(a[key], b[key]));
}

/** The changes between two versions of a list's settings, in form order. */
export function planSettingsChange(
  before: ChallengeSettings,
  after: ChallengeSettings,
  facts: SettingsFacts,
  strategy: AnyStrategy,
): SettingsChange[] {
  const changes: SettingsChange[] = [];
  const add = (field: string, level: ChangeLevel, message: string) => changes.push({ field, level, message });
  const hasItems = facts.entryCount > 0;

  if (after.title !== before.title) add("başlık", "free", `Başlık “${after.title}” olur.`);
  if ((after.description ?? "") !== (before.description ?? "")) add("açıklama", "free", "Açıklama değişir.");

  if (!sameSet(before.mediaTypes, after.mediaTypes)) {
    const allowed = (slug: string) => after.mediaTypes.length === 0 || after.mediaTypes.includes(slug);
    const leftOut = Object.entries(facts.typeCounts).filter(([slug, count]) => count > 0 && !allowed(slug));
    if (leftOut.length === 0) {
      const labels = after.mediaTypes.map((slug) => facts.typeLabels[slug] ?? slug).join(", ");
      add("içerik türleri", "free", labels ? `İçerik türleri: ${labels}.` : "Tüm içerik türleri kabul edilir.");
    }
    for (const [slug, count] of leftOut) {
      add(
        "içerik türleri",
        "confirm",
        `“${facts.typeLabels[slug] ?? slug}” türünde ${count} öge var; yerinde kalırlar, bu türde yeni öge eklenemez.`,
      );
    }
  }

  const timingChanged =
    after.cadenceUnit !== before.cadenceUnit || after.cadenceInterval !== before.cadenceInterval || after.startsOn !== before.startsOn;
  if (timingChanged) {
    if (hasItems) {
      add("zaman", "blocked", "Listede öge varken sıklık ve başlangıç tarihi değiştirilemez: turların tarihleri değişir, ögeler başka turlara düşer.");
    } else {
      add("zaman", "free", "Turlar yeni sıklık ve başlangıca göre yeniden kurulur.");
    }
  }

  if (after.endsOn !== before.endsOn) {
    const cadence = { unit: after.cadenceUnit, interval: after.cadenceInterval };
    const shorter = after.endsOn !== null && (before.endsOn === null || after.endsOn < before.endsOn);
    if (!shorter) {
      add("bitiş tarihi", "free", after.endsOn ? `Liste ${formatDate(after.endsOn)} tarihine kadar sürer.` : "Liste süresiz devam eder.");
    } else if (isTimeBased(cadence) && !timingChanged) {
      const last = lastRoundIndex({ startsOn: after.startsOn, endsOn: after.endsOn, cadence });
      if (facts.lastFilledRound && last !== null && facts.lastFilledRound.index > last) {
        add(
          "bitiş tarihi",
          "blocked",
          `«${facts.lastFilledRound.label}» turunda öge var; bitiş tarihi bu turdan önceye çekilemez. Önce o ögeleri başka bir tura taşı.`,
        );
      } else {
        add("bitiş tarihi", "confirm", `Liste ${formatDate(after.endsOn!)} tarihinde biter; sonraki boş turlar kaldırılır.`);
      }
    } else {
      add("bitiş tarihi", "free", `Liste ${formatDate(after.endsOn!)} tarihinde biter.`);
    }
  }

  if (after.strategy !== before.strategy) {
    if (hasItems) {
      add("öneri kuralı", "blocked", "Listede öge varken öneri kuralı değiştirilemez: ögelerin anlamı (öneri, havuz adayı, plan) kurala bağlı.");
    } else {
      add("öneri kuralı", "free", `Öneri kuralı “${facts.strategyLabels[after.strategy] ?? after.strategy}” olur.`);
    }
  } else if (!sameConfig(before.strategyConfig, after.strategyConfig)) {
    const own = strategy.describeConfigChange?.(before.strategyConfig, after.strategyConfig, { rounds: facts.rounds });
    const described = own ?? [
      { level: "free" as const, message: "Kural ayarları değişir: yeni ayar bundan sonra geçerli olur, mevcut ögeler yerinde kalır." },
    ];
    for (const change of described) add("kural ayarları", change.level, change.message);
  }

  if (after.workflowId !== before.workflowId) {
    if (hasItems) add("durum akışı", "blocked", "Listede öge varken durum akışı değiştirilemez.");
    else add("durum akışı", "free", `Durum akışı “${facts.workflowNames[after.workflowId] ?? "?"}” olur.`);
  }

  if (after.participants.length === 0) {
    add("katılımcılar", "blocked", "Listede en az bir katılımcı kalmalı.");
  } else {
    for (const id of after.participants.filter((participant) => !before.participants.includes(participant))) {
      add("katılımcılar", "free", `${facts.names[id] ?? "?"} listeye katılır.`);
    }
    for (const id of before.participants.filter((participant) => !after.participants.includes(participant))) {
      add(
        "katılımcılar",
        "confirm",
        `${facts.names[id] ?? "?"} listeden ayrılır; eklediği ögeler, notları ve işaretleri kalır, ögeler artık ona ait sayılmaz.`,
      );
    }
  }

  return changes;
}

/** A short fingerprint of what needs a yes: a confirmation counts only for exactly these consequences. */
export function confirmationKey(changes: readonly SettingsChange[]): string {
  const text = changes
    .filter((change) => change.level === "confirm")
    .map((change) => change.message)
    .join("\n");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
