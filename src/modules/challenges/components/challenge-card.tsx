import { CalendarDays, Play } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { progressLabel } from "@/modules/entries/labels";
import { MediaCover } from "@/modules/media/components/media-cover";
import { MediaTitle } from "@/modules/media/components/media-title";
import { formatTitle } from "@/modules/media/titles";
import type { SharedListSummary } from "../summaries";

/** A shared list at a glance: the round that is on now, how long it lasts and what comes next. */
export function ChallengeCard({
  summary,
  typeIcons,
  showGroup = false,
}: {
  summary: SharedListSummary;
  typeIcons: Record<string, string>;
  showGroup?: boolean;
}) {
  const { current, upcoming } = summary;
  const icons = summary.mediaTypes.length ? summary.mediaTypes.map((slug) => typeIcons[slug] ?? "").join(" ") : "📚 🎬 📺";
  const meta = [showGroup ? summary.groupName : null, summary.cadenceLabel, summary.strategyLabel].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/challenges/${summary.id}`}
      className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs transition-colors hover:border-primary/60"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-semibold leading-snug">
            <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden /> {summary.title}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>
        </div>
        <span className="shrink-0 text-lg" aria-hidden>
          {icons}
        </span>
      </div>

      {current ? (
        <div className="rounded-lg bg-accent/70 p-3">
          <p className="flex flex-wrap items-center gap-x-1.5 text-sm font-medium">
            <Play className="size-3 fill-current text-primary" aria-hidden /> {current.label}
            {current.daysLeft ? <span className="font-normal text-muted-foreground">· {current.daysLeft}</span> : null}
          </p>
          {current.items.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-2">
              {current.items.slice(0, 3).map((item) => (
                <li key={item.entryId} className="flex items-center gap-2.5">
                  <MediaCover src={item.imageUrl} title={formatTitle(item)} icon={item.icon} className="w-9" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      <MediaTitle media={item} />
                    </span>
                    {item.creators.length ? (
                      <span className="block truncate text-xs text-muted-foreground">{item.creators.slice(0, 2).join(", ")}</span>
                    ) : null}
                  </span>
                  {item.myStatus ? <Badge tone="violet">{progressLabel(item.myStatus, item.mediaType)}</Badge> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.isPlanning ? "Bu tur için henüz bir şey seçilmedi." : "Bu turda henüz öge yok."}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{summary.timeline}</p>
      )}

      {upcoming.length > 0 ? (
        <div className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-muted-foreground">Sırada</span>
          {upcoming.map((slot) => (
            <p key={slot.label} className="flex min-w-0 gap-1.5">
              <span className="shrink-0 text-muted-foreground">{slot.label}:</span>
              {slot.items.length > 0 ? (
                <span className="truncate font-medium">{slot.items.map((item) => formatTitle(item)).join(", ")}</span>
              ) : (
                <span className="text-muted-foreground">boş</span>
              )}
            </p>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span>
          {summary.participantCount} katılımcı · {summary.entryCount} öge
        </span>
        {summary.isParticipant ? <Badge tone="emerald">Katılıyorsun</Badge> : null}
      </div>
    </Link>
  );
}
