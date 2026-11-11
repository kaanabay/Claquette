// "Bana bir şey seç": a random pick from one's lists, announced with a line from the stars. Pure
// (server and browser); the dialog lives in components/random-pick.tsx.

import type { Titled } from "@/modules/media/titles";

/** Something the pick may land on: a list item nobody asked to be skipped, and where it lives. */
export type PickCandidate = {
  /** The list item. */
  key: string;
  media: Titled & { seasonNumber: number | null; year: number | null; creators: string[]; mediaType: string; imageUrl: string | null };
  icon: string;
  /** Where "Listede göster" goes: the item on its list (`#item-…` on the list page itself). */
  href: string;
  /** The list it is on, when the pick spans all of them. */
  listTitle: string | null;
  externalUrl: string | null;
};

/** The verbs a line needs for an item: "izlemeni", "izle", "izlemelisin". */
export type PickVerbs = { acc: string; imp: string; must: string };

const VERBS: Record<string, PickVerbs> = {
  movie: { acc: "izlemeni", imp: "izle", must: "izlemelisin" },
  tv: { acc: "izlemeni", imp: "izle", must: "izlemelisin" },
  book: { acc: "okumanı", imp: "oku", must: "okumalısın" },
  podcast: { acc: "dinlemeni", imp: "dinle", must: "dinlemelisin" },
  game: { acc: "oynamanı", imp: "oyna", must: "oynamalısın" },
};

export const pickVerbs = (mediaType: string): PickVerbs => VERBS[mediaType] ?? { acc: "denemeni", imp: "dene", must: "denemelisin" };

/** What the dialog says once the pick lands, Turkish and English mixed; each fits the item's verbs. */
export const PICK_LINES: readonly ((verbs: PickVerbs) => string)[] = [
  (v) => `Evren bugün bunu ${v.acc} istedi.`,
  () => "Written in the stars. ✨",
  () => "Yıldızlar hizalandı, sıra bunda.",
  () => "The algorithm has spoken.",
  () => "Kahve falında bu çıktı. Kısmetin açık. ☕",
  () => "Zar atıldı, itiraz kabul edilmiyor. 🎲",
  () => "Destiny called. It said: this one.",
  () => "Tarot kartları üç kez aynı şeyi gösterdi. 🔮",
  (v) => `Bugün bunu ${v.must}. Bilim böyle diyor.`,
  () => "No take-backs. 🫡",
  (v) => `Kader ağlarını ördü; sen de ${v.imp} artık.`,
  () => "The council has decided.",
  () => "Kısmet buymuş. 🧿",
  () => "Nazar boncuğu bile onayladı. 🧿",
  () => "Merkür retrosu bitti, bahane kalmadı.",
  () => "Your future self says thanks.",
  () => "Sihirli 8 topu diyor ki: “Kesinlikle evet.” 🎱",
  () => "Rüyanda gördün, hatırlamıyorsun sadece.",
  () => "Fortune favors the bold. And this one.",
  () => "Bir kelebek kanat çırptı ve bu çıktı. 🦋",
  () => "Zar yalan söylemez. 🎲",
  () => "Today’s main quest unlocked. 🗝️",
  () => "Kozmik ışınlar bunu fısıldadı. 🌌",
  () => "It’s giving… this one.",
  (v) => `Bu bir işaret. Başka işaret bekleme, ${v.imp}.`,
  () => "Kura çekildi, torbadan bu çıktı.",
  () => "Sana bunu söylemek için 13,8 milyar yıl bekledik.",
  () => "Ask and you shall receive.",
  () => "Gönül ne kahve ister ne kahvehane; gönül bunu ister.",
  () => "Yazılmış, çizilmiş, mühürlenmiş. 📜",
  () => "Pas yok, rövanş yok.",
  () => "Şans meleğin bu sefer çok net konuştu. 👼",
  () => "This is the way.",
  () => "Mektup var! Gönderen: Evren. ✉️",
  (v) => `Dolunay da bu fikirde: ${v.imp}. 🌕`,
  () => "Plot twist: seçim çoktan yapılmıştı.",
  () => "Mahallenin bakkalı bile bunu önerirdi.",
  () => "Hükmen galip: bu. 🏆",
  () => "Main character energy. Bugünün başrolü bu.",
  (v) => `Bugün bunu ${v.acc} isteyen bir tek sen değilsin: yıldızlar da istiyor.`,
];

/** For the one candidate there was: no draw, but a line all the same. */
export const ALONE_LINE = "Rakipsiz kazandı. 🏆";

/** What the dialog says while the reel turns. */
export const SPIN_LINES: readonly string[] = ["Çark dönüyor…", "Yıldızlara soruluyor…", "Zarlar havada…", "Fala bakılıyor…", "Shuffling destiny…", "Evrene danışılıyor…"];

/** A random index below `length`, never `avoid` when there is another one to take. */
export function randomIndex(length: number, random: () => number, avoid?: number): number {
  if (length <= 1) return 0;
  if (avoid === undefined || avoid < 0 || avoid >= length) return Math.min(length - 1, Math.floor(random() * length));
  const index = Math.min(length - 2, Math.floor(random() * (length - 1)));
  return index >= avoid ? index + 1 : index;
}

/**
 * The pick and the reel that turns before it lands: `frames` others in a shuffled order (repeating
 * when there are few), then the pick. A new draw avoids the last pick when it can.
 */
export function drawPick<T>(candidates: readonly T[], random: () => number, options: { avoid?: number; frames?: number } = {}): { index: number; reel: T[] } {
  if (candidates.length === 0) return { index: -1, reel: [] };
  const index = randomIndex(candidates.length, random, options.avoid);
  const others = candidates.filter((_, i) => i !== index);
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const frames = options.frames ?? 14;
  const reel = others.length > 0 ? Array.from({ length: frames }, (_, i) => others[i % others.length]) : [];
  return { index, reel: [...reel, candidates[index]] };
}

/** The line for a pick, never the one shown just before. */
export function pickLine(mediaType: string, random: () => number, avoid?: number): { index: number; text: string } {
  const index = randomIndex(PICK_LINES.length, random, avoid);
  return { index, text: PICK_LINES[index](pickVerbs(mediaType)) };
}

const NOUNS: Record<string, string> = { book: "kitap", movie: "film", tv: "dizi", podcast: "podcast", game: "oyun" };

/** The button: "Bana bir şey seç", or "Bana bir film seç" while the page shows only films. */
export const pickButtonLabel = (mediaType: string | null) => `Bana bir ${mediaType ? (NOUNS[mediaType] ?? "öge") : "şey"} seç`;

/** When there is nothing to pick: nothing of that kind at all, or everything finished already. */
export function emptyPickMessage(mediaType: string | null, total: number, scope: "list" | "all"): string {
  const where = scope === "list" ? "Bu listede" : "Listelerinde";
  if (total > 0) return "Hepsini bitirmişsin, seçecek bir şey kalmadı. 🎉";
  return mediaType ? `${where} hiç ${NOUNS[mediaType] ?? "öge"} yok.` : `${where} henüz öge yok.`;
}
