import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { mediaItems, mediaTypes } from "@/db/schema";
import { titleColumns } from "./columns";
import { AppError } from "@/lib/action-state";
import { getProvider, providersFor } from "./providers";
import type { MediaTypeOption } from "./types";

export type MediaInput =
  | { kind: "external"; provider: string; externalId: string; mediaType: string }
  // An item already in the catalog (picked from one of the user's lists).
  | { kind: "catalog"; mediaItemId: string; mediaType: string }
  | {
      kind: "manual";
      mediaType: string;
      title: string;
      originalTitle: string | null;
      seasonNumber: number | null;
      creators: string[];
      year: number | null;
      imageUrl: string | null;
      description: string | null;
    };

export type { MediaTypeOption } from "./types";

export async function listMediaTypes(): Promise<MediaTypeOption[]> {
  const rows = await db
    .select({ slug: mediaTypes.slug, label: mediaTypes.label, icon: mediaTypes.icon, creatorLabel: mediaTypes.creatorLabel })
    .from(mediaTypes)
    .where(eq(mediaTypes.isActive, true))
    .orderBy(asc(mediaTypes.sortOrder));
  return rows.map((row) => ({ ...row, sources: providersFor(row.slug).map((provider) => provider.label) }));
}

export type ResolvedMedia = {
  id: string;
  title: string;
  originalTitle: string | null;
  internationalTitle: string | null;
  seasonNumber: number | null;
  mediaType: string;
};

/**
 * Returns the catalog item for a suggestion: an API result is imported once and then reused
 * (deduplicated by source + external id); manual input always creates a new item.
 * Provider calls happen outside any transaction so no DB connection waits on the network.
 */
export async function resolveMediaItem(input: MediaInput, userId: string): Promise<ResolvedMedia> {
  if (input.kind === "catalog") {
    // The catalog is shared by everyone, so any existing item may be reused.
    const [item] = await db
      .select({ id: mediaItems.id, ...titleColumns, mediaType: mediaItems.mediaType })
      .from(mediaItems)
      .innerJoin(mediaTypes, eq(mediaTypes.slug, mediaItems.mediaType))
      .where(and(eq(mediaItems.id, input.mediaItemId), eq(mediaTypes.isActive, true)))
      .limit(1);
    if (!item) throw new AppError("Seçilen öge bulunamadı.");
    return item;
  }

  const [type] = await db
    .select({ slug: mediaTypes.slug })
    .from(mediaTypes)
    .where(and(eq(mediaTypes.slug, input.mediaType), eq(mediaTypes.isActive, true)))
    .limit(1);
  if (!type) throw new AppError("Bilinmeyen içerik türü.");

  const returning = { id: mediaItems.id, ...titleColumns, mediaType: mediaItems.mediaType };

  if (input.kind === "manual") {
    const [created] = await db
      .insert(mediaItems)
      .values({
        mediaType: input.mediaType,
        title: input.title,
        originalTitle: input.originalTitle,
        seasonNumber: input.seasonNumber,
        creators: input.creators,
        year: input.year,
        imageUrl: input.imageUrl,
        description: input.description,
        source: "manual",
        createdBy: userId,
      })
      .returning(returning);
    return created;
  }

  const existing = await findExternal(input.provider, input.externalId);
  if (existing) return existing;

  const provider = getProvider(input.provider);
  if (!provider || !provider.mediaTypes.includes(input.mediaType)) throw new AppError("Geçersiz veri kaynağı.");

  let details;
  try {
    details = await provider.getDetails(input.externalId, input.mediaType);
  } catch (error) {
    console.warn(`[media] ${provider.id} details failed:`, error);
    details = null;
  }
  if (!details) {
    throw new AppError(`${provider.label} şu an yanıt vermiyor. Biraz sonra dene ya da içeriği elle ekle.`);
  }

  const [created] = await db
    .insert(mediaItems)
    .values({
      mediaType: details.mediaType,
      title: details.title,
      originalTitle: details.originalTitle !== details.title ? details.originalTitle : null,
      internationalTitle: details.internationalTitle ?? null,
      seasonNumber: details.seasonNumber ?? null,
      year: details.year,
      creators: details.creators,
      description: details.description,
      imageUrl: details.imageUrl,
      source: provider.id,
      externalId: details.externalId,
      externalUrl: details.externalUrl,
      metadata: details.metadata,
      createdBy: userId,
    })
    .onConflictDoNothing({
      target: [mediaItems.source, mediaItems.externalId],
      where: sql`${mediaItems.externalId} is not null`,
    })
    .returning(returning);

  // Someone imported the same item concurrently.
  return created ?? (await findExternal(provider.id, details.externalId))!;
}

async function findExternal(source: string, externalId: string): Promise<ResolvedMedia | null> {
  const [row] = await db
    .select({ id: mediaItems.id, ...titleColumns, mediaType: mediaItems.mediaType })
    .from(mediaItems)
    .where(and(eq(mediaItems.source, source), eq(mediaItems.externalId, externalId)))
    .limit(1);
  return row ?? null;
}
