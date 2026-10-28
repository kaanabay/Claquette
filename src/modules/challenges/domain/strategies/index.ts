import { jointStrategy } from "./joint";
import { openStrategy } from "./open";
import { poolStrategy } from "./pool";
import { rotationStrategy } from "./rotation";
import type { AnyStrategy, ConfigField } from "./types";

export * from "./types";
export { pickFromPool } from "./pool";

// The registry. To add a strategy (e.g. "random draw", "bracket", "theme of the month"),
// implement ChallengeStrategy in a new file and list it here — the database stores only
// the key and a JSON config, so no migration is needed. The first one is the form's default.
export const STRATEGIES = [jointStrategy, rotationStrategy, openStrategy, poolStrategy] as const satisfies readonly AnyStrategy[];

export type StrategyKey = (typeof STRATEGIES)[number]["key"];

export const STRATEGY_KEYS = STRATEGIES.map((s) => s.key) as [StrategyKey, ...StrategyKey[]];

export function findStrategy(key: string): AnyStrategy | undefined {
  return (STRATEGIES as readonly AnyStrategy[]).find((s) => s.key === key);
}

export function getStrategy(key: string): AnyStrategy {
  const strategy = findStrategy(key);
  if (!strategy) throw new Error(`Unknown challenge strategy: ${key}`);
  return strategy;
}

export function defaultConfig(strategy: AnyStrategy): Record<string, unknown> {
  return strategy.configSchema.parse({});
}

/** Reads a stored config; unknown or invalid values fall back to the defaults. */
export function parseStoredConfig(strategy: AnyStrategy, raw: unknown): Record<string, unknown> {
  const merged = { ...defaultConfig(strategy), ...(typeof raw === "object" && raw !== null ? raw : {}) };
  const result = strategy.configSchema.safeParse(merged);
  return result.success ? result.data : defaultConfig(strategy);
}

type FormLike = { get(name: string): FormDataEntryValue | null; has(name: string): boolean };

export const configFieldName = (strategyKey: string, field: string) => `config.${strategyKey}.${field}`;

/** Turns submitted form fields into raw config values (validated afterwards by the schema). */
export function readConfigFromForm(strategy: AnyStrategy, form: FormLike): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of strategy.configFields as readonly ConfigField[]) {
    const name = configFieldName(strategy.key, field.name);
    if (field.type === "boolean") {
      values[field.name] = form.has(name);
      continue;
    }
    const raw = form.get(name);
    if (typeof raw !== "string" || raw.trim() === "") continue;
    values[field.name] = field.type === "number" ? Number(raw) : raw;
  }
  return values;
}
