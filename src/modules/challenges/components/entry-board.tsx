import { Popcorn } from "lucide-react";
import { Fold, ShowMore } from "@/components/fold";
import { FilterEmpty, FilteredCount } from "@/components/item-filter";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { EntryCard } from "@/modules/entries/components/entry-card";
import { entryFilterKey } from "@/modules/entries/filter-key";
import type { ChallengePageData } from "../queries";

/**
 * Entries grouped by workflow state, in workflow order. Each state folds: what is still on (waiting
 * for an answer, in progress) starts open; what is finished or set aside starts folded, since it
 * only grows. Long states show their first six.
 */
export function EntryBoard({ board }: { board: ChallengePageData["board"] }) {
  if (board.every((column) => column.entries.length === 0)) {
    return (
      <EmptyState icon={<Popcorn />} title="Henüz öneri yok">
        İlk öneriyi yaptığında burada durumlarına göre listelenecek.
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {board.map(({ state, entries }) => {
        const keys = entries.map((card) => entryFilterKey(card));
        const over = state.category === "done" || state.category === "dropped";
        // A dropped state with nothing in it says nothing worth a line.
        if (state.category === "dropped" && entries.length === 0) return null;
        return (
          <Fold
            key={state.id}
            level={3}
            defaultOpen={!over}
            remember={`board-${state.category}`}
            items={entries.length > 0 ? keys : undefined}
            title={
              <>
                <Badge tone={state.color}>{state.label}</Badge>
                <span className="font-normal text-muted-foreground">
                  <FilteredCount items={keys} />
                </span>
              </>
            }
          >
            {entries.length > 0 ? (
              <>
                <ShowMore initial={6} items={keys} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {entries.map((card) => (
                    <EntryCard key={card.id} card={card} showState={false} />
                  ))}
                </ShowMore>
                <FilterEmpty items={keys} />
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Bu durumda öge yok.</p>
            )}
          </Fold>
        );
      })}
    </div>
  );
}
