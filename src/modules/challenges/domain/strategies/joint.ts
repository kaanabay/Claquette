import { z } from "zod";
import { defineStrategy } from "./types";

const configSchema = z.object({
  itemsPerRound: z.number().int().min(0).max(10).default(1),
});

export type JointConfig = z.infer<typeof configSchema>;

/**
 * Joint decision ("Birlikte belirliyoruz"): no turns. What the group agreed on (in person, on
 * WhatsApp…) goes straight into a round, past or future; an idea someone has alone waits as a
 * suggestion until another participant accepts it into a round.
 */
export const jointStrategy = defineStrategy<JointConfig>({
  key: "joint",
  label: "Birlikte belirliyoruz",
  summary:
    "Sıra yok. Anlaştığınızı biriniz plana ekler, aklına geleni öneri olarak bırakır. Turlar önceden ya da geriye dönük doldurulabilir.",
  configSchema,
  configFields: [
    {
      type: "number",
      name: "itemsPerRound",
      label: "Tur başına öge",
      help: "0 = sınırsız. Ör. her çeyreğe bir kitap.",
      min: 0,
      max: 10,
    },
  ],

  planRound() {
    return [];
  },

  suggestionOptions() {
    return { allowed: true, placement: "plan", targets: [null], remaining: null, initialCategory: "pending" };
  },

  planning(config) {
    return { itemsPerRound: config.itemsPerRound > 0 ? config.itemsPerRound : null };
  },

  describeConfig(config) {
    return config.itemsPerRound > 0 ? `Tur başına ${config.itemsPerRound} öge` : "Tur başına sınırsız öge";
  },

  // A lower limit never moves items: rounds that hold more keep them and take no new ones.
  describeConfigChange(before, after, { rounds }) {
    const limit = after.itemsPerRound;
    if (limit === before.itemsPerRound) return [];
    if (limit === 0) return [{ level: "free", message: "Turlara sınırsız öge eklenebilir." }];
    const over = rounds.filter((round) => round.count > limit);
    if (over.length === 0) return [{ level: "free", message: `Tur başına en fazla ${limit} öge eklenebilir.` }];
    const list = over.map((round) => `«${round.label}» (${round.count} öge)`).join(", ");
    return [
      {
        level: "confirm",
        message: `Tur başına en fazla ${limit} öge olacak. ${list} bu sınırın üstünde: ögeler olduğu gibi kalır, bu turlara yeni öge eklenmez.`,
      },
    ];
  },
});
