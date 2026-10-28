import { z } from "zod";
import { defineStrategy } from "./types";

const configSchema = z.object({
  maxPerRound: z.number().int().min(0).max(50).default(0),
  allowGroupTarget: z.boolean().default(true),
  requireAcceptance: z.boolean().default(true),
});

export type OpenConfig = z.infer<typeof configSchema>;

/** Free-for-all ("Serbest öneri"): anyone suggests to anyone, optionally capped per round. */
export const openStrategy = defineStrategy<OpenConfig>({
  key: "open",
  label: "Serbest öneri",
  summary: "Tur sürerken herkes istediği kişiye ya da tüm gruba öneri yapabilir. İstersen tur başına limit koy.",
  configSchema,
  configFields: [
    {
      type: "number",
      name: "maxPerRound",
      label: "Tur başına kişi başı öneri limiti",
      help: "0 = sınırsız",
      min: 0,
      max: 50,
    },
    { type: "boolean", name: "allowGroupTarget", label: "Tüm gruba öneri yapılabilsin" },
    { type: "boolean", name: "requireAcceptance", label: "Öneriler kabul onayı beklesin" },
  ],

  planRound() {
    return [];
  },

  suggestionOptions({ config, userId, participants, round, roundSuggestions }) {
    if (!round) return { allowed: false, reason: "Şu an aktif bir tur yok." };

    const targets: (string | null)[] = participants.filter((p) => p.userId !== userId).map((p) => p.userId);
    if (config.allowGroupTarget) targets.unshift(null);
    if (targets.length === 0) return { allowed: false, reason: "Öneri yapabileceğin başka katılımcı yok." };

    let remaining: number | null = null;
    if (config.maxPerRound > 0) {
      remaining = config.maxPerRound - roundSuggestions.length;
      if (remaining <= 0) {
        return { allowed: false, reason: `Bu tur için öneri limitine ulaştın (${config.maxPerRound}).` };
      }
    }

    return {
      allowed: true,
      placement: "round",
      targets,
      remaining,
      initialCategory: config.requireAcceptance ? "pending" : "active",
    };
  },

  describeConfig(config) {
    const limit = config.maxPerRound > 0 ? `tur başına ${config.maxPerRound} öneri` : "sınırsız";
    return `Serbest · ${limit}${config.requireAcceptance ? " · onaylı" : ""}`;
  },
});
