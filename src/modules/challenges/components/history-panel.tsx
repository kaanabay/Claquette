import { ArrowRight, CircleCheck, Clock, Plus } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EntryCard } from "@/modules/entries/queries";
import { describeRoundSummary } from "@/modules/entries/tracking";
import { MediaTitle } from "@/modules/media/components/media-title";
import { canRecordPick } from "../domain/history";
import type { ChallengePageData } from "../queries";

type HistoryRoundView = NonNullable<ChallengePageData["history"]>["rounds"][number];

/** Whether the viewer may enter a missing pick of a round that is over (see canRecordPick). */
const mayFill = (data: ChallengePageData, pickerId: string) =>
  data.challenge.status === "active" &&
  canRecordPick({
    actorId: data.viewerId,
    pickerId,
    timing: "past",
    isParticipant: data.access.isParticipant,
    isAdmin: data.access.isAdmin,
  }).ok;

/**
 * Rounds that are over, with who picked what for whom. A pick nobody entered (turns from before
 * the list was opened here, too) can be entered afterwards by its picker, or by a group admin on
 * their behalf; it is credited to that round's picker either way.
 */
export function HistoryPanel({ data }: { data: ChallengePageData }) {
  const history = data.history;
  if (!history || history.rounds.length === 0) return null;
  const filled = history.rounds.filter((round) => round.summary.total > 0).length;
  const fillable = history.rounds.some((round) => round.slots.some((slot) => slot.open > 0 && mayFill(data, slot.pickerId)));

  return (
    <section>
      <details open={history.rounds.length <= 3} className="group">
        <summary className="mb-3 cursor-pointer list-none text-sm font-medium text-muted-foreground">
          Geçmiş turlar ({history.rounds.length}) · {filled} dolu ·{" "}
          <span className="underline-offset-4 group-open:hidden hover:underline">göster</span>
          <span className="hidden underline-offset-4 group-open:inline hover:underline">gizle</span>
        </summary>
        {fillable ? (
          <p className="mb-3 text-sm text-muted-foreground">
            {data.access.isAdmin
              ? "Girilmemiş önerileri sonradan ekleyebilirsin; öge o turda öneren kişinin adına yazılır."
              : "Girilmemiş önerilerini sonradan ekleyebilirsin. Başkalarınınkini kendileri ya da grup yöneticileri girer."}
          </p>
        ) : null}
        <ol className="flex flex-col gap-3">
          {history.rounds.map((round) => (
            <HistoryRound key={round.index} round={round} data={data} />
          ))}
        </ol>
      </details>
    </section>
  );
}

function HistoryRound({ round, data }: { round: HistoryRoundView; data: ChallengePageData }) {
  const summary = describeRoundSummary(round.summary, data.viewerId, true);
  const waiting = round.summary.waiting.length > 0;
  return (
    <li className={cn("rounded-xl border bg-card p-3 shadow-xs sm:p-4", round.summary.total === 0 && "bg-muted/40")}>
      <p className="font-semibold leading-tight">{round.label}</p>
      <p className={cn("mt-0.5 text-xs text-muted-foreground", waiting && "text-amber-700 dark:text-amber-300")}>
        {["Geçti", summary].filter(Boolean).join(" · ")}
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {round.slots.map((slot) => (
          <PickRow key={slot.key} pickerId={slot.pickerId} pickerName={slot.pickerName} recipientName={slot.recipientName} entries={slot.entries}>
            {slot.open > 0 && mayFill(data, slot.pickerId) ? (
              <Link
                href={`/challenges/${data.challenge.id}?add=1&round=${round.index}&slot=${encodeURIComponent(slot.key)}`}
                className={buttonVariants({ variant: slot.entries.length > 0 ? "ghost" : "outline", size: "sm" })}
              >
                <Plus /> Ekle
              </Link>
            ) : slot.entries.length === 0 ? (
              <span className="text-muted-foreground">Girilmemiş</span>
            ) : null}
          </PickRow>
        ))}
        {round.extras.map((card) => (
          <PickRow
            key={card.id}
            pickerId={card.suggestedBy?.id ?? card.id}
            pickerName={card.suggestedBy?.name ?? "Silinmiş kullanıcı"}
            recipientName={card.suggestedFor?.name ?? null}
            entries={[card]}
          />
        ))}
      </ul>
    </li>
  );
}

/** "Ali → Kaan: Persona ✓", with room for the button that fills it in. */
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
