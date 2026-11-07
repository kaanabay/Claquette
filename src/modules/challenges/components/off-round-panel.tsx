import { CalendarOff } from "lucide-react";
import Link from "next/link";
import { FilterDetails, FilterEmpty, FilteredCount } from "@/components/item-filter";
import { buttonVariants } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/misc";
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
    <section>
      <SectionTitle
        action={
          canAdd ? (
            <Link href={`/challenges/${data.challenge.id}?add=1&round=off`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <CalendarOff /> Tur dışına ekle
            </Link>
          ) : null
        }
      >
        {OFF_ROUND}{" "}
        <span className="font-normal text-muted-foreground">
          (<FilteredCount items={openKeys} />)
        </span>
      </SectionTitle>
      <p className="mb-4 text-sm text-muted-foreground">
        Turlara girmeyen ögeler. Herkes kendi zamanında bitirip işaretler; herkes bitirince ya da pas geçince tamamlanır.
      </p>
      {open.length === 0 ? (
        <p className="text-xs text-muted-foreground">Bekleyen tur dışı öge yok.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {open.map((card) => (
              <EntryCard key={card.id} card={card} showState={false} showRound={false} byline="added" />
            ))}
          </div>
          <FilterEmpty items={openKeys} />
        </>
      )}
      {done.length > 0 ? (
        <FilterDetails items={doneKeys} className="group mt-4">
          <summary className="mb-3 flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
            Bitenler
            <span className="font-normal text-muted-foreground">
              <FilteredCount items={doneKeys} /> · <span className="group-open:hidden">göster</span>
              <span className="hidden group-open:inline">gizle</span>
            </span>
          </summary>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {done.map((card) => (
              <EntryCard key={card.id} card={card} showRound={false} byline="added" />
            ))}
          </div>
        </FilterDetails>
      ) : null}
    </section>
  );
}
