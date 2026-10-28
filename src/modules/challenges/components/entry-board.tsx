import { Popcorn } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { EntryCard } from "@/modules/entries/components/entry-card";
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
        const grid = (
          <div className="grid gap-3 sm:grid-cols-2">
            {entries.map((card) => (
              <EntryCard key={card.id} card={card} showState={false} />
            ))}
          </div>
        );
        if (state.category === "dropped") {
          if (entries.length === 0) return null;
          return (
            <details key={state.id} className="group">
              <summary className="mb-3 flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
                <Badge tone={state.color}>{state.label}</Badge>
                <span className="text-muted-foreground">{entries.length} · göster</span>
              </summary>
              {grid}
            </details>
          );
        }
        return (
          <section key={state.id}>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Badge tone={state.color}>{state.label}</Badge>
              <span className="text-muted-foreground">{entries.length}</span>
            </h3>
            {entries.length > 0 ? grid : <p className="text-xs text-muted-foreground">Bu durumda öge yok.</p>}
          </section>
        );
      })}
    </div>
  );
}
