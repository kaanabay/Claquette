import Link from "next/link";
import { ShowMore } from "@/components/fold";
import { formatShortDate } from "@/lib/short-date";
import { MediaCover } from "@/modules/media/components/media-cover";
import { MediaTitle } from "@/modules/media/components/media-title";
import { formatTitle } from "@/modules/media/titles";
import type { ProfileFinish } from "../queries";

/** What someone finished, newest first: the day, and the list where (a shared one's card, or their own list). */
export function FinishedShelf({ rows }: { rows: ProfileFinish[] }) {
  return (
    <ShowMore initial={6} items={rows.map((row) => row.filterKey)} as="ul" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {rows.map((row) => (
        <li key={row.mediaItemId} className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-xs">
          <MediaCover src={row.media.imageUrl} title={formatTitle(row.media)} icon={row.type.icon} className="w-10" />
          <div className="min-w-0">
            {row.href ? (
              <Link href={row.href} className="line-clamp-2 font-medium leading-snug hover:underline">
                <MediaTitle media={row.media} />
              </Link>
            ) : (
              <p className="line-clamp-2 font-medium leading-snug">
                <MediaTitle media={row.media} />
              </p>
            )}
            <p className="truncate text-xs text-muted-foreground">{[formatShortDate(row.finishedAt), row.where].filter(Boolean).join(" · ")}</p>
          </div>
        </li>
      ))}
    </ShowMore>
  );
}
