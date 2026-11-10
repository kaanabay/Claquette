import { CalendarOff } from "lucide-react";
import { Fold, ShowMore } from "@/components/fold";
import { FilterEmpty, FilteredCount } from "@/components/item-filter";
import { EntryCard } from "@/modules/entries/components/entry-card";
import { entryFilterKey } from "@/modules/entries/filter-key";
import { OFF_ROUND } from "@/modules/entries/placement";
import type { AssignedItems } from "../queries";

// What is due or on now starts open; what comes later starts folded.
const GROUPS = [
  { key: "overdue", title: "Zamanı geçenler", open: true },
  { key: "current", title: "Devam edenler", open: true },
  { key: "upcoming", title: "Sıradakiler", open: false },
] as const;

/**
 * "Bana atananlar": what the viewer still has to finish, by rounds that are over, running or coming.
 * "Tur dışı" items have no date and pile up easily, so they wait folded at the end.
 */
export function AssignedSection({ assigned }: { assigned: AssignedItems }) {
  const total = GROUPS.reduce((sum, group) => sum + assigned[group.key].length, 0);
  const offRound = assigned.offRound;
  const keysOf = (items: AssignedItems[keyof AssignedItems]) => items.map(({ card }) => entryFilterKey(card, true));
  return (
    <Fold remember="home-assigned" title="Bana atananlar">
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">Şu an bitirmen gereken bir şey yok.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {GROUPS.map(({ key, title, open }) =>
            assigned[key].length > 0 ? (
              <Fold
                key={key}
                level={3}
                defaultOpen={open}
                remember={`home-assigned-${key}`}
                items={keysOf(assigned[key])}
                title={
                  <>
                    {title}{" "}
                    <span className="font-normal text-muted-foreground">
                      <FilteredCount items={keysOf(assigned[key])} />
                    </span>
                  </>
                }
              >
                <ShowMore initial={6} items={keysOf(assigned[key])} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {assigned[key].map(({ card, note }) => (
                    <EntryCard key={card.id} card={card} showChallenge showState={false} roundNote={note} />
                  ))}
                </ShowMore>
              </Fold>
            ) : null,
          )}
        </div>
      )}
      <FilterEmpty items={[...GROUPS.flatMap(({ key }) => keysOf(assigned[key])), ...keysOf(offRound)]} />
      {offRound.length > 0 ? (
        <Fold
          level={3}
          defaultOpen={false}
          remember="home-assigned-off-round"
          items={keysOf(offRound)}
          className="mt-6"
          title={
            <>
              <CalendarOff className="size-4 text-muted-foreground" aria-hidden />
              {OFF_ROUND}{" "}
              <span className="font-normal text-muted-foreground">
                <FilteredCount items={keysOf(offRound)} />
              </span>
            </>
          }
        >
          <p className="mb-3 text-xs text-muted-foreground">
            Turlara girmeyen, tarihi olmayan ögeler; kendi zamanında bitirebilirsin. Yapmayacaksan kartındaki “İzlemeyeceğim” ya da
            “Okumayacağım” düğmesi onu buradan kaldırır.
          </p>
          <ShowMore initial={6} items={keysOf(offRound)} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {offRound.map(({ card }) => (
              <EntryCard key={card.id} card={card} showChallenge showState={false} showRound={false} />
            ))}
          </ShowMore>
        </Fold>
      ) : null}
    </Fold>
  );
}
