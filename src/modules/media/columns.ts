import "server-only";
import { mediaItems } from "@/db/schema";

/** Every name of a media item: select these wherever one is shown (see titles.ts). */
export const titleColumns = {
  title: mediaItems.title,
  originalTitle: mediaItems.originalTitle,
  internationalTitle: mediaItems.internationalTitle,
  seasonNumber: mediaItems.seasonNumber,
};
