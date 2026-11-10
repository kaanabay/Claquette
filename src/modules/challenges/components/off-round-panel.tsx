import { CalendarOff } from "lucide-react";
import Link from "next/link";
import { Fold, ShowMore } from "@/components/fold";
import { FilterEmpty, FilteredCount } from "@/components/item-filter";
import { buttonVariants } from "@/components/ui/button";
import { EntryCard } from "@/modules/entries/components/entry-card";
import { entryFilterKey } from "@/modules/entries/filter-key";
import { OFF_ROUND } from "@/modules/entries/placement";
import type { ChallengePageData } from "../queries";

/**
 * "Tur dışı": items the group keeps in the list but outside the rounds, each person finishing them on
 * their own time (typically one of them has already seen it). Shown once the list has any.
 */
export function OffRoundPanel({ data }: { data: ChallengePageData }) {
  const { open, done, canAdd } = data.offRound;
  if (open.length + done.length === 0) return null;
  const openKeys = open.map((card) => entryFilterKey(card));
  const doneKeys = done.map((card) => entryFilterKey(card));

  return (
    <Fold
      remember="off-round"
      title={
        <>
          {OFF_ROUND}{" "}
          <span className="font-normal text-muted-foreground">
            (<FilteredCount items={openKeys} />)
          </span>
        </>
      }
      action={
        canAdd ? (
          <Link href={`/challenges/${data.challenge.id}?add=1&round=off`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <CalendarOff /> Tur dışına ekle
          </Link>
        ) : null
      }
    >
      <p className="mb-4 text-sm text-muted-foreground">
        Turlara girmeyen ögeler. Herkes kendi zamanında bitirip işaretler; herkes bitirince ya da pas geçince tamamlanır.
      </p>
      {open.length === 0 ? (
        <p className="text-xs text-muted-foreground">Bekleyen tur dışı öge yok.</p>
      ) : (
        <>
          <ShowMore initial={6} items={openKeys} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {open.map((card) => (
              <EntryCard key={card.id} card={card} showState={false} showRound={false} byline="added" />
            ))}
          </ShowMore>
          <FilterEmpty items={openKeys} />
        </>
      )}
      {done.length > 0 ? (
        // Finished: over, so folded.
        <Fold
          level={3}
          defaultOpen={false}
          remember="off-round-done"
          items={doneKeys}
          className="mt-4"
          title={
            <>
              Bitenler{" "}
              <span className="font-normal text-muted-foreground">
                <FilteredCount items={doneKeys} />
              </span>
            </>
          }
        >
          <ShowMore initial={6} items={doneKeys} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {done.map((card) => (
              <EntryCard key={card.id} card={card} showRound={false} byline="added" />
            ))}
          </ShowMore>
        </Fold>
      ) : null}
    </Fold>
  );
}
