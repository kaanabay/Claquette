import { z } from "zod";
import { defineStrategy, type PoolSelection } from "./types";

const configSchema = z.object({
  selection: z.enum(["votes", "random", "manual"]).default("votes"),
  picksPerRound: z.number().int().min(1).max(10).default(1),
  autoDraw: z.boolean().default(true),
  maxCandidatesPerUser: z.number().int().min(0).max(50).default(0),
});

export type PoolConfig = z.infer<typeof configSchema>;

const SELECTION_LABELS: Record<PoolSelection, string> = {
  votes: "En çok oy alan",
  random: "Kura",
  manual: "Elle seçim",
};

/** Shared pool ("Ortak havuz"): everyone adds candidates, each round picks from the pool. */
export const poolStrategy = defineStrategy<PoolConfig>({
  key: "pool",
  label: "Ortak havuz",
  summary: "Herkes havuza aday ekler; her tur havuzdan oylamayla, kurayla ya da elle seçim yapılır.",
  configSchema,
  configFields: [
    {
      type: "select",
      name: "selection",
      label: "Seçim yöntemi",
      options: [
        { value: "votes", label: "En çok oy alan (eşitlikte kura)" },
        { value: "random", label: "Kura (rastgele)" },
        { value: "manual", label: "Elle seçim" },
      ],
    },
    { type: "number", name: "picksPerRound", label: "Tur başına seçilecek öge", min: 1, max: 10 },
    {
      type: "boolean",
      name: "autoDraw",
      label: "Yeni tur başlayınca otomatik seç",
      help: "Elle seçim yönteminde kullanılmaz.",
    },
    {
      type: "number",
      name: "maxCandidatesPerUser",
      label: "Kişi başı bekleyen aday limiti",
      help: "0 = sınırsız",
      min: 0,
      max: 50,
    },
  ],

  planRound() {
    return [];
  },

  suggestionOptions({ config, poolCandidates }) {
    const limit = config.maxCandidatesPerUser;
    if (limit > 0 && poolCandidates >= limit) {
      return { allowed: false, reason: `Havuzda bekleyen aday limitine ulaştın (${limit}).` };
    }
    return {
      allowed: true,
      placement: "pool",
      targets: [null],
      remaining: limit > 0 ? limit - poolCandidates : null,
      initialCategory: "pending",
    };
  },

  poolRules(config) {
    return {
      picksPerRound: config.picksPerRound,
      selection: config.selection,
      autoDraw: config.autoDraw && config.selection !== "manual",
    };
  },

  describeConfig(config) {
    return `${SELECTION_LABELS[config.selection]} · tur başına ${config.picksPerRound}`;
  },
});

/**
 * Chooses `count` candidates. "votes" takes the most voted (ties broken randomly),
 * "random" draws uniformly, "manual" never picks automatically.
 */
export function pickFromPool<T extends { votes: number }>(
  candidates: readonly T[],
  count: number,
  selection: PoolSelection,
  random: () => number = Math.random,
): T[] {
  if (count <= 0 || selection === "manual") return [];
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  // Array#sort is stable, so equal vote counts keep their shuffled order.
  if (selection === "votes") shuffled.sort((a, b) => b.votes - a.votes);
  return shuffled.slice(0, count);
}
