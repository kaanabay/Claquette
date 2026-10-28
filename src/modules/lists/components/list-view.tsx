import { CalendarDays, ExternalLink } from "lucide-react";
import { EmptyState } from "@/components/ui/misc";
import { formatShortDate } from "@/lib/short-date";
import { MediaCover } from "@/modules/media/components/media-cover";
import { MediaTitle } from "@/modules/media/components/media-title";
import { formatTitle, nativeTitle } from "@/modules/media/titles";
import type { ListPageData } from "../queries";

/** Read-only list for visitors (a friend opening a shared link). Rank numbers only in the list's own order. */
export function ListView({ items, isRanked, manual }: { items: ListPageData["items"]; isRanked: boolean; manual: boolean }) {
  if (items.length === 0) {
    return <EmptyState title="Bu liste henüz boş" />;
  }
  return (
    <ol className="flex flex-col gap-3">
      {items.map((item, index) => {
        const meta = [item.media.year, item.media.creators.slice(0, 3).join(", ")].filter(Boolean).join(" · ");
        return (
          <li key={item.id} className="flex items-start gap-3 rounded-xl border bg-card p-3 shadow-xs sm:gap-4">
            {isRanked && manual ? (
              <span className="w-8 shrink-0 pt-1 text-right text-2xl font-semibold tabular-nums text-primary">{index + 1}</span>
            ) : null}
            <MediaCover src={item.media.imageUrl} title={formatTitle(item.media)} icon={item.type.icon} className="w-16 sm:w-20" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="font-semibold leading-snug">
                <MediaTitle media={item.media} />
              </p>
              {nativeTitle(item.media) ? <p className="text-xs text-muted-foreground">{nativeTitle(item.media)}</p> : null}
              <p className="text-xs text-muted-foreground">
                {item.type.icon} {item.type.label}
                {meta ? ` · ${meta}` : ""}
              </p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays className="size-3" /> {formatShortDate(item.addedAt)}
              </p>
              {item.note ? <p className="mt-1 whitespace-pre-wrap text-sm italic text-muted-foreground">“{item.note}”</p> : null}
              {item.media.externalUrl ? (
                <a
                  href={item.media.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 flex w-fit items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  <ExternalLink className="size-3" /> Kaynakta aç
                </a>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
