import { z } from "zod";
import type { MediaInput } from "./service";
import { formatTitle } from "./titles";
import { MAX_BATCH } from "./types";

// Form fields written by MediaPicker. Every form that adds media (a suggestion, a personal list
// item) parses its own fields separately and these schemas on the same values: the picked items
// arrive as one JSON field (`items`), a manually typed item as plain fields (`source=manual`).

const emptyToNull = (value: string | undefined) => value || null;

const base = z.object({ mediaType: z.string().min(1, "Bir içerik türü seç.") });

const externalSchema = base.extend({
  source: z.literal("external"),
  provider: z.string().min(1, "Listeden bir sonuç seç."),
  externalId: z.string().min(1, "Listeden bir sonuç seç.").max(64),
});

const catalogSchema = base.extend({
  source: z.literal("catalog"),
  mediaItemId: z.uuid("Listeden bir öge seç."),
});

const manualSchema = base.extend({
  source: z.literal("manual"),
  title: z.string().trim().min(1, "Başlık zorunlu.").max(200, "En fazla 200 karakter."),
  originalTitle: z.string().trim().max(200).optional().transform(emptyToNull),
  // Series only: "Lost · 2. Sezon".
  seasonNumber: z
    .union([z.coerce.number().int().min(1, "Geçerli bir sezon gir.").max(200, "Geçerli bir sezon gir."), z.literal("")])
    .optional()
    .transform((value) => (typeof value === "number" ? value : null)),
  creators: z.string().trim().max(300).optional(),
  year: z
    .union([z.coerce.number().int().min(1000, "Geçerli bir yıl gir.").max(2100, "Geçerli bir yıl gir."), z.literal("")])
    .optional()
    .transform((value) => (typeof value === "number" ? value : null)),
  imageUrl: z
    .union([z.url({ protocol: /^https?$/, error: "Geçerli bir görsel adresi gir (https://...)." }), z.literal("")])
    .optional()
    .transform(emptyToNull),
  description: z.string().trim().max(2000, "En fazla 2000 karakter.").optional().transform(emptyToNull),
});

function toMediaInput(data: z.output<typeof externalSchema> | z.output<typeof catalogSchema> | z.output<typeof manualSchema>): MediaInput {
  switch (data.source) {
    case "external":
      return { kind: "external", provider: data.provider, externalId: data.externalId, mediaType: data.mediaType };
    case "catalog":
      return { kind: "catalog", mediaItemId: data.mediaItemId, mediaType: data.mediaType };
    case "manual":
      return {
        kind: "manual",
        mediaType: data.mediaType,
        title: data.title,
        originalTitle: data.originalTitle,
        seasonNumber: data.mediaType === "tv" ? data.seasonNumber : null,
        creators: (data.creators ?? "")
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean)
          .slice(0, 10),
        year: data.year,
        imageUrl: data.imageUrl,
        description: data.description,
      };
  }
}

export const mediaInputSchema = z
  .discriminatedUnion("source", [externalSchema, catalogSchema, manualSchema], "Eklenecek içeriği seç.")
  .transform(toMediaInput);

/** One picked item: its key in the picker, a title for messages, and what to resolve. */
const pickedSchema = z
  .discriminatedUnion(
    "source",
    [
      externalSchema.extend({ key: z.string().max(200), label: z.string().max(200) }),
      catalogSchema.extend({ key: z.string().max(200), label: z.string().max(200) }),
    ],
    "Seçim okunamadı, sayfayı yenileyip tekrar dene.",
  )
  .transform((data) => ({ key: data.key, label: data.label, media: toMediaInput(data) }));

export type PickedMedia = z.output<typeof pickedSchema>;

/** The `items` field: the picker's selection as JSON (its problems are reported under `items`). */
const pickedFieldSchema = z.object({
  items: z
    .string()
    .optional()
    .transform((raw, ctx) => {
      if (!raw?.trim()) return [];
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "Seçim okunamadı, sayfayı yenileyip tekrar dene." });
        return z.NEVER;
      }
    })
    .pipe(z.array(pickedSchema, "Seçim okunamadı, sayfayı yenileyip tekrar dene.").max(MAX_BATCH, `Bir seferde en fazla ${MAX_BATCH} öge eklenebilir.`)),
});

/**
 * Everything a form wants to add: the picked items plus a manually typed one (when its title is
 * filled in). Returns the items or the validation error.
 */
export function readMediaToAdd(
  values: Record<string, string>,
): { ok: true; items: PickedMedia[] } | { ok: false; error: z.ZodError } {
  const picked = pickedFieldSchema.safeParse(values);
  if (!picked.success) return { ok: false, error: picked.error };
  const items = [...picked.data.items];
  if (values.source === "manual" && values.title?.trim()) {
    const manual = mediaInputSchema.safeParse(values);
    if (!manual.success) return { ok: false, error: manual.error };
    const media = manual.data;
    const label = media.kind === "manual" ? formatTitle(media) : values.title.trim();
    items.push({ key: "manual", label, media });
  }
  return { ok: true, items };
}
