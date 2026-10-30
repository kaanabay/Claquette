import { z } from "zod";
import { defineStrategy } from "./types";

const configSchema = z.object({
  mode: z.enum(["pairs", "turns"]).default("pairs"),
  picksPerTurn: z.number().int().min(1).max(5).default(1),
  requireAcceptance: z.boolean().default(true),
});

export type RotationConfig = z.infer<typeof configSchema>;

/**
 * Rotation ("Sırayla öneri").
 * - pairs: everyone suggests to someone else and the ring shifts every round, so over n-1
 *   rounds everyone has suggested to everyone. With 2 people it is a mutual exchange.
 * - turns: one picker per round chooses for the whole group (classic book club).
 */
export const rotationStrategy = defineStrategy<RotationConfig>({
  key: "rotation",
  label: "Sırayla öneri",
  summary:
    "Her tur kimin kime önereceği otomatik belirlenir. İki kişide karşılıklı takas olur; 'Tek seçici' modunda her tur sıradaki kişi tüm grup için seçer.",
  configSchema,
  configFields: [
    {
      type: "select",
      name: "mode",
      label: "Eşleştirme",
      options: [
        { value: "pairs", label: "Karşılıklı / zincir: herkes sıradaki kişiye önerir" },
        { value: "turns", label: "Tek seçici: her tur bir kişi tüm grup için seçer" },
      ],
    },
    { type: "number", name: "picksPerTurn", label: "Tur başına kişi başı öneri", min: 1, max: 5 },
    {
      type: "boolean",
      name: "requireAcceptance",
      label: "Öneriler kabul onayı beklesin",
      help: "Kapalıysa öneri doğrudan 'Kabul Edildi' olarak başlar.",
    },
  ],

  planRound({ config, roundIndex, participants }) {
    const n = participants.length;
    if (n === 0) return [];
    if (config.mode === "turns") {
      return [{ pickerId: participants[roundIndex % n].userId, recipientId: null }];
    }
    if (n < 2) return [];
    // shift ∈ 1..n-1, never 0, so nobody is assigned to themselves.
    const shift = (roundIndex % (n - 1)) + 1;
    return participants.map((participant, i) => ({
      pickerId: participant.userId,
      recipientId: participants[(i + shift) % n].userId,
    }));
  },

  suggestionOptions({ config, userId, round, assignments, roundSuggestions }) {
    if (!round) return { allowed: false, reason: "Şu an aktif bir tur yok." };

    const mine = assignments.filter((a) => a.pickerId === userId);
    if (mine.length === 0) {
      return {
        allowed: false,
        reason: config.mode === "turns" ? "Bu turda seçim sırası sende değil." : "Bu turda sana düşen bir öneri yok.",
      };
    }

    const used = (recipientId: string | null) => roundSuggestions.filter((s) => s.recipientId === recipientId).length;
    const open = mine.filter((a) => used(a.recipientId) < config.picksPerTurn);
    if (open.length === 0) return { allowed: false, reason: "Bu turdaki önerilerini tamamladın." };

    return {
      allowed: true,
      placement: "round",
      targets: [...new Set(open.map((a) => a.recipientId))],
      remaining: open.reduce((sum, a) => sum + config.picksPerTurn - used(a.recipientId), 0),
      initialCategory: config.requireAcceptance ? "pending" : "active",
    };
  },

  // Turns that went by (before the list was opened here, too) are filled in pick by pick.
  history(config) {
    return { picksPerAssignment: config.picksPerTurn };
  },

  describeConfig(config) {
    const mode = config.mode === "pairs" ? "Karşılıklı" : "Tek seçici";
    return `${mode} · kişi başı ${config.picksPerTurn} öneri${config.requireAcceptance ? " · onaylı" : ""}`;
  },
});
