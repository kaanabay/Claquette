import { z } from "zod";

export type FieldErrors = Record<string, string[] | undefined>;

/**
 * Shape returned by every Server Action used with useActionState. A batch action lists the keys
 * of the items it did add (`added`), so a form can drop them and keep only what still needs
 * attention, and the ids of the rows it created (`created`), so the page can point them out.
 */
export type ActionState =
  | { error?: string; fieldErrors?: FieldErrors; success?: string; added?: string[]; created?: string[] }
  | undefined;

/** An expected, user-facing failure (shown in the form instead of crashing the page). */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

export function validationError(error: z.ZodError, message = "Lütfen işaretli alanları kontrol et."): ActionState {
  return { error: message, fieldErrors: z.flattenError(error).fieldErrors as FieldErrors };
}

/** Several schemas parsed from the same form: their field errors together, a form-level one as the message. */
export function validationErrors(
  errors: readonly (z.ZodError | undefined)[],
  message = "Lütfen işaretli alanları kontrol et.",
): ActionState {
  const fieldErrors: FieldErrors = {};
  let formError: string | undefined;
  for (const error of errors) {
    if (!error) continue;
    const flat = z.flattenError(error);
    Object.assign(fieldErrors, flat.fieldErrors);
    formError ??= flat.formErrors[0];
  }
  return { error: formError ?? message, fieldErrors };
}

/**
 * Outcome of adding several items one by one: the keys that went in (with the ids of the rows
 * they became), and why the rest didn't.
 */
export type BatchResult = { added: string[]; ids: string[]; failed: { key: string; label: string; message: string }[] };

/** Form state after adding several items. */
export function batchState(result: BatchResult, success: (count: number) => string): ActionState {
  if (result.failed.length === 0) return { success: success(result.added.length), added: result.added, created: result.ids };
  const reasons = result.failed
    .map((failure) => (failure.message.includes(failure.label) ? failure.message : `“${failure.label}”: ${failure.message}`))
    .join(" ");
  const done = result.added.length > 0 ? `${result.added.length} öge eklendi. ` : "";
  return { error: `${done}Eklenemeyen: ${reasons}`, added: result.added, created: result.ids };
}

/** Converts AppError into form state; anything else is a bug and keeps propagating. */
export function toActionState(error: unknown): ActionState {
  if (error instanceof AppError) return { error: error.message };
  throw error;
}
