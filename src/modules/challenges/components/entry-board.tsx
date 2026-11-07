import { Popcorn } from "lucide-react";
import { FilterDetails, FilterEmpty, FilteredCount } from "@/components/item-filter";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { EntryCard } from "@/modules/entries/components/entry-card";
import { entryFilterKey } from "@/modules/entries/filter-key";
import type { ChallengePageData } from "../queries";

/** Entries grouped by workflow state, in workflow order. Dropped ones stay folded away. */
export function EntryBoard({ board }: { board: ChallengePageData["board"] }) {
  if (board.every((column) => column.entries.length === 0)) {
    return (
      <EmptyState icon={<Popcorn />} title="Henüz öneri yok">
        İlk öneriyi yaptığında burada durumlarına göre listelenecek.
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {board.map(({ state, entries }) => {
        const keys = entries.map((card) => entryFilterKey(card));
        const grid = (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {entries.map((card) => (
                <EntryCard key={card.id} card={card} showState={false} />
              ))}
            </div>
            <FilterEmpty items={keys} />
          </>
        );
        if (state.category === "dropped") {
          if (entries.length === 0) return null;
          return (
            <FilterDetails key={state.id} items={keys} className="group">
              <summary className="mb-3 flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
                <Badge tone={state.color}>{state.label}</Badge>
                <span className="text-muted-foreground">
                  <FilteredCount items={keys} /> · göster
                </span>
              </summary>
              {grid}
            </FilterDetails>
          );
        }
        return (
          <section key={state.id}>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Badge tone={state.color}>{state.label}</Badge>
              <span className="text-muted-foreground">
                <FilteredCount items={keys} />
              </span>
            </h3>
            {entries.length > 0 ? grid : <p className="text-xs text-muted-foreground">Bu durumda öge yok.</p>}
          </section>
        );
      })}
    </div>
  );
}
