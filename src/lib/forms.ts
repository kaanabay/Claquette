import { z } from "zod";
import { toDayValue } from "./short-date";

/** Plain object from FormData (last value wins); drops React's internal $ACTION fields. */
export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION") || typeof value !== "string") continue;
    values[key] = value;
  }
  return values;
}

export function formList(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((value): value is string => typeof value === "string" && value !== "");
}

/** A day from a date input: not before 1900, not after today (in Turkey). */
export const daySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir tarih seç.")
  .refine((day) => day >= "1900-01-01" && day <= toDayValue(new Date()), "Bugünden ileri bir tarih seçilemez.");
