import { CalendarOff } from "lucide-react";
import { SectionTitle } from "@/components/ui/misc";
import { EntryCard } from "@/modules/entries/components/entry-card";
import { OFF_ROUND } from "@/modules/entries/placement";
import type { AssignedItems } from "../queries";

const GROUPS = [
  { key: "overdue", title: "Zamanı geçenler" },
  { key: "current", title: "Devam edenler" },
  { key: "upcoming", title: "Sıradakiler" },
] as const;

/**
 * "Bana atananlar": what the viewer still has to finish, by rounds that are over, running or coming.
 * "Tur dışı" items have no date and pile up easily, so they wait folded at the end.
 */
export function AssignedSection({ assigned }: { assigned: AssignedItems }) {
  const total = GROUPS.reduce((sum, group) => sum + assigned[group.key].length, 0);
  const offRound = assigned.offRound;
  return (
    <section>
      <SectionTitle>Bana atananlar</SectionTitle>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">Şu an bitirmen gereken bir şey yok.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {GROUPS.map(({ key, title }) =>
            assigned[key].length > 0 ? (
              <div key={key} className="flex flex-col gap-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  {title} <span className="font-normal text-muted-foreground">{assigned[key].length}</span>
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {assigned[key].map(({ card, note }) => (
                    <EntryCard key={card.id} card={card} showChallenge showState={false} roundNote={note} />
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </div>
      )}
      {offRound.length > 0 ? (
        <details className="group mt-6">
          <summary className="mb-3 flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
            <CalendarOff className="size-4 text-muted-foreground" aria-hidden />
            {OFF_ROUND}
            <span className="font-normal text-muted-foreground">
              {offRound.length} · <span className="group-open:hidden">göster</span>
              <span className="hidden group-open:inline">gizle</span>
            </span>
          </summary>
          <p className="mb-3 text-xs text-muted-foreground">
            Turlara girmeyen, tarihi olmayan ögeler; kendi zamanında bitirebilirsin. Yapmayacaksan kartındaki “İzlemeyeceğim” ya da
            “Okumayacağım” düğmesi onu buradan kaldırır.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {offRound.map(({ card }) => (
              <EntryCard key={card.id} card={card} showChallenge showState={false} showRound={false} />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
