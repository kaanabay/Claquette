import { ArrowRight, CircleCheck, Clock, Hourglass, Plus, UserPen } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EntryCard } from "@/modules/entries/queries";
import { describeRoundSummary } from "@/modules/entries/tracking";
import { MediaTitle } from "@/modules/media/components/media-title";
import type { ChallengePageData } from "../queries";
import type { RoundView } from "../targets";

/**
 * The rounds of a list without planning around the current one: those ahead ("upcoming", on a
 * calendar) or those that are over ("past"). Each shows who added what (a rotation: who picks for
 * whom) and offers what the viewer may add there: their own item, or as a group admin someone else's.
 */
export function RoundsPanel({ data, kind }: { data: ChallengePageData; kind: "upcoming" | "past" }) {
  const rounds = (kind === "upcoming" ? data.timeline?.upcoming : data.timeline?.past) ?? [];
  if (rounds.length === 0) return null;
  const filled = rounds.filter((round) => round.summary.total > 0).length;
  const title = kind === "upcoming" ? "Sıradaki turlar" : "Geçmiş turlar";
  const hint =
    kind === "past"
      ? data.access.isAdmin
        ? "Girilmemiş olanları sonradan ekleyebilirsin; öge, kimin adına girersen onun olarak yazılır."
        : "Kendi girilmemiş önerilerini sonradan ekleyebilirsin. Başkalarınınkini kendileri ya da grup yöneticileri girer."
      : "Sıradaki turlara şimdiden öneri yapabilirsin; tur gelince onun önerisi olur.";
  const offers = rounds.some((round) => round.canAdd || round.slots.some((slot) => slot.add));

  return (
    <section aria-label={title}>
      <details open={kind === "upcoming" || rounds.length <= 3} className="group">
        <summary className="mb-3 cursor-pointer list-none text-sm font-medium text-muted-foreground">
          {title} ({rounds.length}) · {filled} dolu ·{" "}
          <span className="underline-offset-4 group-open:hidden hover:underline">göster</span>
          <span className="hidden underline-offset-4 group-open:inline hover:underline">gizle</span>
        </summary>
        {offers ? <p className="mb-3 text-sm text-muted-foreground">{hint}</p> : null}
        <ol className="flex flex-col gap-3">
          {rounds.map((round) => (
            <RoundRow key={round.index} round={round} data={data} />
          ))}
        </ol>
      </details>
    </section>
  );
}

function RoundRow({ round, data }: { round: RoundView; data: ChallengePageData }) {
  const past = round.timing === "past";
  // Rounds ahead have nothing to finish yet.
  const summary = past ? describeRoundSummary(round.summary, data.viewerId, true) : null;
  const waiting = past && round.summary.waiting.length > 0;
  const addHref = (as?: string) => `/challenges/${data.challenge.id}?add=1&round=${round.index}${as ? `&as=${as}` : ""}`;
  const usesAssignments = round.slots.length > 0;
  const addLabel = past ? (round.items.length > 0 ? "Ekle" : "Doldur") : data.strategy.key === "pool" ? "Ekle" : "Öner";

  return (
    <li className={cn("rounded-xl border bg-card p-3 shadow-xs sm:p-4", round.summary.total === 0 && "bg-muted/40")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold leading-tight">{round.label}</p>
          <p className={cn("mt-0.5 text-xs text-muted-foreground", waiting && "text-amber-700 dark:text-amber-300")}>
            {[past ? "Geçti" : "Sırada", summary].filter(Boolean).join(" · ")}
          </p>
        </div>
        {!usesAssignments && round.canAdd ? (
          <Link href={addHref()} className={buttonVariants({ variant: round.items.length > 0 ? "ghost" : "outline", size: "sm" })}>
            <Plus /> {addLabel}
          </Link>
        ) : null}
      </div>
      {usesAssignments || round.items.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {round.slots.map((slot) => (
            <PickRow key={slot.key} pickerId={slot.pickerId} pickerName={slot.pickerName} recipientName={slot.recipientName} entries={slot.entries}>
              {slot.add === "own" ? (
                <Link href={addHref()} className={buttonVariants({ variant: slot.entries.length > 0 ? "ghost" : "outline", size: "sm" })}>
                  <Plus /> {past ? "Ekle" : "Öner"}
                </Link>
              ) : slot.add === "behalf" ? (
                <Link
                  href={addHref(slot.pickerId)}
                  title={`${slot.pickerName} adına ekle`}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  <UserPen /> Adına ekle
                </Link>
              ) : slot.entries.length === 0 ? (
                <span className="text-muted-foreground">{past ? "Girilmemiş" : "Öneri bekleniyor"}</span>
              ) : null}
            </PickRow>
          ))}
          {(usesAssignments ? round.extras : round.items).map((card) => (
            <PickRow
              key={card.id}
              pickerId={card.suggestedBy?.id ?? card.id}
              pickerName={card.suggestedBy?.name ?? "Silinmiş kullanıcı"}
              recipientName={card.suggestedFor?.name ?? null}
              entries={[card]}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{past ? "Bu tura bir şey girilmemiş." : "Henüz bir şey yok."}</p>
      )}
    </li>
  );
}

/** "Ali → Kaan: Persona ✓", with room for the button that adds to it. */
function PickRow({
  pickerId,
  pickerName,
  recipientName,
  entries,
  children,
}: {
  pickerId: string;
  pickerName: string;
  recipientName: string | null;
  entries: EntryCard[];
  children?: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span className="flex items-center gap-2">
        <Avatar name={pickerName} seed={pickerId} className="size-6 text-[10px]" />
        <span className="font-medium">{pickerName}</span>
        <ArrowRight className="size-3.5 text-muted-foreground" />
        <span>{recipientName ?? "Tüm grup"}</span>
      </span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {entries.map((card) => (
          <span key={card.id} className="flex items-center gap-1.5">
            {card.state.category === "done" ? (
              <CircleCheck className="size-4 shrink-0 text-success" aria-label="Bitti" />
            ) : card.tracking?.overdue ? (
              <Clock className="size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-label="Zamanı geçti" />
            ) : card.state.category === "pending" ? (
              <Hourglass className="size-4 shrink-0 text-muted-foreground" aria-label="Cevap bekliyor" />
            ) : null}
            <Link href={`/entries/${card.id}`} className="hover:underline">
              <MediaTitle media={card.media} />
            </Link>
          </span>
        ))}
        {children}
      </span>
    </li>
  );
}
