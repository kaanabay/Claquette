import { ArrowRight, Check, Clock, Star, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatShortDate } from "@/lib/short-date";
import { cn } from "@/lib/utils";
import { MediaCover } from "@/modules/media/components/media-cover";
import { MediaTitle } from "@/modules/media/components/media-title";
import { formatTitle } from "@/modules/media/titles";
import { formatRating, progressLabel } from "../labels";
import type { EntryCard as EntryCardData } from "../queries";
import { listPeople, type TrackingPerson } from "../tracking";
import { ProgressToggle } from "./progress-toggle";

export function EntryCard({
  card,
  showChallenge = false,
  showState = true,
  showRound = true,
  byline = "recipient",
  roundNote,
  footer,
  className,
}: {
  card: EntryCardData;
  showChallenge?: boolean;
  showState?: boolean;
  showRound?: boolean;
  /** "recipient": "Kaan → Ayşe"; in planning lists items are simply "added" or "suggested". */
  byline?: "recipient" | "added" | "suggested";
  /** Shown after the round: "3 gün kaldı", "dün bitti". */
  roundNote?: string | null;
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
          {roundNote ? <span className="font-medium text-foreground/80">{roundNote}</span> : null}
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
          {/* The finish button below already shows "finished" for the viewer. */}
          {card.mine && !(card.canMark && card.mine.status === "completed") ? (
            <Badge tone="violet">{progressLabel(card.mine.status, card.media.mediaType)}</Badge>
          ) : null}
        </div>
        {card.pitch ? <p className="line-clamp-2 text-sm italic text-muted-foreground">“{card.pitch}”</p> : null}
        <TrackingRow card={card} />
        {footer}
      </div>
    </article>
  );
}

/** Who it is meant for and who finished it, "Zamanı geçti" once its round is over, and the viewer's own button. */
function TrackingRow({ card }: { card: EntryCardData }) {
  const { tracking } = card;
  if (!tracking) return null;
  // The viewer's own state is the button; the others are shown next to it.
  const others = card.canMark ? tracking.people.filter((person) => person.id !== card.viewerId) : tracking.people;
  if (!tracking.overdue && others.length === 0 && !card.canMark) return null;
  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
      {tracking.overdue ? (
        <Badge tone="amber" title={`Henüz bitirmeyen: ${listPeople(tracking.waiting, card.viewerId)}`}>
          <Clock /> Zamanı geçti
        </Badge>
      ) : null}
      {others.map((person) => (
        <PersonChip key={person.id} person={person} mediaType={card.media.mediaType} />
      ))}
      {card.canMark ? (
        <ProgressToggle
          entryId={card.id}
          title={formatTitle(card.media)}
          mediaType={card.media.mediaType}
          status={card.mine?.status ?? null}
          className="ml-auto"
        />
      ) : null}
    </div>
  );
}

function PersonChip({ person, mediaType }: { person: TrackingPerson; mediaType: string }) {
  const firstName = person.name.split(" ")[0];
  const status = person.status ? progressLabel(person.status, mediaType) : "Başlamadı";
  const done = person.status === "completed";
  return (
    <Badge
      tone={done ? "emerald" : undefined}
      title={`${person.name}: ${status}`}
      className={cn(!done && "font-normal", person.status === "dropped" && "line-through")}
    >
      {done ? <Check /> : null}
      {firstName}
      <span className="sr-only">: {status}</span>
    </Badge>
  );
}
