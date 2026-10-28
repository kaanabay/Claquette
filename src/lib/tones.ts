// Workflow states store a palette token; full class names live here so Tailwind can see them.
export const TONES = {
  slate: "bg-slate-500/10 text-slate-700 ring-slate-500/25 dark:text-slate-300",
  amber: "bg-amber-500/15 text-amber-800 ring-amber-500/30 dark:text-amber-300",
  sky: "bg-sky-500/15 text-sky-800 ring-sky-500/30 dark:text-sky-300",
  emerald: "bg-emerald-500/15 text-emerald-800 ring-emerald-500/30 dark:text-emerald-300",
  rose: "bg-rose-500/15 text-rose-800 ring-rose-500/30 dark:text-rose-300",
  violet: "bg-violet-500/15 text-violet-800 ring-violet-500/30 dark:text-violet-300",
} as const;

export type Tone = keyof typeof TONES;

export function toneClass(color: string): string {
  return color in TONES ? TONES[color as Tone] : TONES.slate;
}

const DOTS: Record<Tone, string> = {
  slate: "bg-slate-400",
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
};

export function dotClass(color: string): string {
  return color in DOTS ? DOTS[color as Tone] : DOTS.slate;
}

// Deterministic avatar colors.
const AVATAR_TONES = [
  "bg-amber-500 text-amber-950",
  "bg-sky-500 text-sky-950",
  "bg-emerald-500 text-emerald-950",
  "bg-rose-500 text-rose-950",
  "bg-violet-500 text-violet-50",
  "bg-teal-500 text-teal-950",
  "bg-orange-500 text-orange-950",
  "bg-indigo-500 text-indigo-50",
];

export function avatarTone(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
}
