// Pure workflow rules (no I/O). States come from the database; behaviour keys off categories.

export const STATE_CATEGORIES = ["pending", "active", "done", "dropped"] as const;
export type StateCategory = (typeof STATE_CATEGORIES)[number];

export type WorkflowState = {
  id: string;
  key: string;
  label: string;
  category: StateCategory;
  color: string;
  position: number;
};

export const CATEGORY_LABELS: Record<StateCategory, string> = {
  pending: "Karar bekliyor",
  active: "Sürüyor",
  done: "Tamamlandı",
  dropped: "Elendi",
};

export function sortStates<T extends { position: number }>(states: readonly T[]): T[] {
  return [...states].sort((a, b) => a.position - b.position);
}

export function firstStateIn<T extends { category: StateCategory; position: number }>(
  states: readonly T[],
  category: StateCategory,
): T | undefined {
  return sortStates(states).find((state) => state.category === category);
}

/** The state a new entry starts in; falls back to the first state when the category is missing. */
export function initialState<T extends { category: StateCategory; position: number }>(
  states: readonly T[],
  preferred: Extract<StateCategory, "pending" | "active">,
): T {
  const state = firstStateIn(states, preferred) ?? sortStates(states)[0];
  if (!state) throw new Error("Workflow has no states");
  return state;
}

const TURKISH_ASCII: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };

/** Stable keys for new states: "Kabul Edildi" → "kabul_edildi", unique within the workflow. */
export function stateKeys(labels: readonly string[]): string[] {
  const used = new Set<string>();
  return labels.map((label) => {
    const base =
      label
        .toLocaleLowerCase("tr-TR")
        .replace(/[çğıöşü]/g, (char) => TURKISH_ASCII[char] ?? char)
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "") || "durum";
    let key = base;
    for (let i = 2; used.has(key); i++) key = `${base}_${i}`;
    used.add(key);
    return key;
  });
}

/**
 * Who may move an entry to another state. A personal suggestion that is still pending is
 * answered by its recipient; its author may only withdraw it. Everything else is open to
 * the challenge's participants (and group admins), because friends trust each other.
 */
export function canChangeState(input: {
  actorId: string;
  suggestedBy: string | null;
  suggestedFor: string | null;
  currentCategory: StateCategory;
  targetCategory: StateCategory;
  isParticipant: boolean;
  isGroupAdmin: boolean;
}): boolean {
  if (input.isGroupAdmin) return true;
  if (input.suggestedFor && input.currentCategory === "pending") {
    if (input.actorId === input.suggestedFor) return true;
    if (input.actorId === input.suggestedBy) return input.targetCategory === "dropped";
    return false;
  }
  return input.isParticipant || input.actorId === input.suggestedBy;
}
