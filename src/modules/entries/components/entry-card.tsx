import { ArrowRight, Star, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatShortDate } from "@/lib/short-date";
import { cn } from "@/lib/utils";
import { MediaCover } from "@/modules/media/components/media-cover";
import { MediaTitle } from "@/modules/media/components/media-title";
import { formatTitle } from "@/modules/media/titles";
import { formatRating, progressLabel } from "../labels";
import type { EntryCard as EntryCardData } from "../queries";

export function EntryCard({
  card,
  showChallenge = false,
  showState = true,
  showRound = true,
  byline = "recipient",
  footer,
  className,
}: {
  card: EntryCardData;
  showChallenge?: boolean;
  showState?: boolean;
  showRound?: boolean;
  /** "recipient": "Kaan → Ayşe"; in planning lists items are simply "added" or "suggested". */
  byline?: "recipient" | "added" | "suggested";
  footer?: React.ReactNode;
  className?: string;
}) {
  const href = `/entries/${card.id}`;
  const meta = [card.media.year, card.media.creators.slice(0, 2).join(", ")].filter(Boolean).join(" · ");
  return (
    <article data-highlight-id={card.id} className={cn("flex gap-3 rounded-xl border bg-card p-3 shadow-xs", className)}>
      <Link href={href} className="shrink-0" tabIndex={-1} aria-hidden>
        <MediaCover src={card.media.imageUrl} title={formatTitle(card.media)} icon={card.media.icon} className="w-16" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <Link href={href} className="line-clamp-2 font-medium leading-snug hover:underline">
            <MediaTitle media={card.media} />
          </Link>
          {showState ? <Badge tone={card.state.color}>{card.state.label}</Badge> : null}
        </div>
        {meta ? <p className="truncate text-xs text-muted-foreground">{meta}</p> : null}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {showChallenge ? <span className="font-medium text-foreground/80">{card.challengeTitle}</span> : null}
          {showRound && card.roundLabel ? <Badge>{card.roundLabel}</Badge> : null}
          {card.suggestedBy ? (
            byline === "recipient" ? (
              <span className="flex items-center gap-1">
                {card.suggestedBy.name} <ArrowRight className="size-3" /> {card.suggestedFor?.name ?? "Grup"}
              </span>
            ) : (
              <span>
                {card.suggestedBy.name} {byline === "added" ? "ekledi" : "önerdi"}
              </span>
            )
          ) : null}
          <time dateTime={card.createdAt.toISOString()} title="Eklenme tarihi">
            {formatShortDate(card.createdAt)}
          </time>
          {card.stats.avgRating !== null ? (
            <span className="flex items-center gap-0.5" title={`${card.stats.ratingCount} puan`}>
              <Star className="size-3 fill-amber-400 text-amber-500" /> {formatRating(card.stats.avgRating)}/10
            </span>
          ) : null}
          {card.votes > 0 ? (
            <span className="flex items-center gap-0.5">
              <ThumbsUp className="size-3" /> {card.votes}
            </span>
          ) : null}
          {card.mine ? <Badge tone="violet">{progressLabel(card.mine.status, card.media.mediaType)}</Badge> : null}
        </div>
        {card.pitch ? <p className="line-clamp-2 text-sm italic text-muted-foreground">“{card.pitch}”</p> : null}
        {footer}
      </div>
    </article>
  );
}
