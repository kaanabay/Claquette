import { Globe, ListOrdered, Lock } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MediaCover } from "@/modules/media/components/media-cover";
import type { ListCover, ListSummary } from "../queries";

/** A personal list at a glance: its covers, what is in it, and who can see it. No dates, no statuses. */
export function ListCard({ list }: { list: ListSummary }) {
  return (
    <Link
      href={`/lists/${list.id}`}
      className="group flex gap-4 rounded-xl border bg-card p-4 shadow-xs transition-colors hover:border-primary/60"
    >
      <CoverStack covers={list.covers} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="line-clamp-2 font-semibold leading-snug">{list.title}</p>
        <p className="text-xs text-muted-foreground">{list.countsLabel}</p>
        {list.description ? <p className="line-clamp-2 text-sm text-muted-foreground">{list.description}</p> : null}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          <VisibilityBadge visibility={list.visibility} />
          {list.isRanked ? (
            <Badge>
              <ListOrdered /> Sıralı
            </Badge>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export function VisibilityBadge({ visibility }: { visibility: "private" | "public" }) {
  return visibility === "public" ? (
    <Badge tone="emerald">
      <Globe /> Herkese açık
    </Badge>
  ) : (
    <Badge>
      <Lock /> Gizli
    </Badge>
  );
}

/** Up to four covers fanned out like a small shelf; an empty frame for a new list. */
export function CoverStack({ covers, className }: { covers: ListCover[]; className?: string }) {
  if (covers.length === 0) {
    return (
      <div
        className={cn(
          "flex aspect-[2/3] w-16 shrink-0 items-center justify-center rounded-md border border-dashed text-xl text-muted-foreground",
          className,
        )}
        aria-hidden
      >
        ＋
      </div>
    );
  }
  return (
    <div className={cn("relative h-24 w-24 shrink-0", className)} aria-hidden>
      {covers.slice(0, 4).map((cover, i) => (
        <MediaCover
          key={i}
          src={cover.imageUrl}
          title={cover.title}
          icon={cover.icon}
          className="absolute top-0 w-14 shadow-sm"
          style={{ left: `${i * 10}px`, zIndex: 4 - i, transform: `rotate(${(i - 1) * 3}deg)` }}
        />
      ))}
    </div>
  );
}
