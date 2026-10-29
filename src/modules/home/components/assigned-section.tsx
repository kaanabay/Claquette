import { SectionTitle } from "@/components/ui/misc";
import { EntryCard } from "@/modules/entries/components/entry-card";
import type { AssignedItems } from "../queries";

const GROUPS = [
  { key: "overdue", title: "Zamanı geçenler" },
  { key: "current", title: "Devam edenler" },
  { key: "upcoming", title: "Sıradakiler" },
] as const;

/** "Bana atananlar": what the viewer still has to finish, by rounds that are over, running or coming. */
export function AssignedSection({ assigned }: { assigned: AssignedItems }) {
  const total = GROUPS.reduce((sum, group) => sum + assigned[group.key].length, 0);
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
                <div className="grid gap-3 sm:grid-cols-2">
                  {assigned[key].map(({ card, note }) => (
                    <EntryCard key={card.id} card={card} showChallenge showState={false} roundNote={note} />
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </div>
      )}
    </section>
  );
}
