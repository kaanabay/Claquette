import { CalendarPlus, Lightbulb, Plus, Undo2, X } from "lucide-react";
import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, SectionTitle } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import { changeEntryStateAction } from "@/modules/entries/actions";
import { EntryCard } from "@/modules/entries/components/entry-card";
import type { ChallengePageData } from "../queries";
import { daysLeft } from "../timeline";
import { PlaceForm } from "./place-form";

type Plan = NonNullable<ChallengePageData["plan"]>;
type PlanSlotView = Plan["slots"][number];

/** The rounds of a planning list: what was done, what is on now, what is planned or still open. */
export function PlanPanel({ data }: { data: ChallengePageData }) {
  const plan = data.plan;
  if (!plan) return null;
  const past = plan.slots.filter((slot) => slot.timing === "past");
  const ahead = plan.slots.filter((slot) => slot.timing !== "past");
  const filledPast = past.filter((slot) => slot.entries.length > 0).length;

  return (
    <section>
      <SectionTitle>Plan</SectionTitle>
      {past.length > 0 ? (
        <details open={ahead.length === 0 || past.length <= 3} className="group mb-4">
          <summary className="mb-3 cursor-pointer list-none text-sm font-medium text-muted-foreground">
            Geçmiş turlar ({past.length}) · {filledPast} dolu · <span className="underline-offset-4 group-open:hidden hover:underline">göster</span>
            <span className="hidden underline-offset-4 group-open:inline hover:underline">gizle</span>
          </summary>
          <ol className="flex flex-col gap-3">
            {past.map((slot) => (
              <SlotRow key={slot.index} slot={slot} data={data} />
            ))}
          </ol>
        </details>
      ) : null}
      {ahead.length > 0 ? (
        <ol className="flex flex-col gap-3">
          {ahead.map((slot) => (
            <SlotRow key={slot.index} slot={slot} data={data} />
          ))}
        </ol>
      ) : past.length === 0 ? (
        <EmptyState icon={<CalendarPlus />} title="Henüz tur yok">
          Liste başladığında turlar burada görünecek. Bu arada öneri ekleyebilirsiniz.
        </EmptyState>
      ) : null}
    </section>
  );
}

function SlotRow({ slot, data }: { slot: PlanSlotView; data: ChallengePageData }) {
  const plan = data.plan!;
  const remaining = slot.timing === "current" ? daysLeft(slot.endsOn, data.today) : null;
  const status =
    slot.timing === "current" ? ["Bu tur", remaining].filter(Boolean).join(" · ") : slot.timing === "past" ? "Geçti" : "Sırada";
  const canAdd = plan.canEdit && !slot.isFull;

  return (
    <li
      className={cn(
        "rounded-xl border bg-card p-3 shadow-xs sm:p-4",
        slot.timing === "current" && "border-primary/70 ring-1 ring-primary/30",
        slot.timing === "past" && slot.entries.length === 0 && "bg-muted/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold leading-tight">{slot.label}</p>
          <p className={cn("mt-0.5 text-xs", slot.timing === "current" ? "font-medium text-foreground" : "text-muted-foreground")}>
            {status}
          </p>
        </div>
        {canAdd ? (
          <Link
            href={`/challenges/${data.challenge.id}?add=1&round=${slot.index}`}
            className={buttonVariants({ variant: slot.entries.length ? "ghost" : "outline", size: "sm" })}
          >
            <Plus /> {slot.entries.length ? "Ekle" : "Doldur"}
          </Link>
        ) : null}
      </div>
      {slot.entries.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {slot.entries.map((card) => (
            <EntryCard key={card.id} card={card} showRound={false} byline="added" className="shadow-none" />
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{slot.timing === "past" ? "Bu tura bir şey girilmemiş." : "Henüz belirlenmedi."}</p>
      )}
    </li>
  );
}

/** Ideas waiting for a round. Someone other than the author accepts them into the plan. */
export function SuggestionsPanel({ data }: { data: ChallengePageData }) {
  const plan = data.plan;
  if (!plan) return null;
  const { suggestions } = plan;

  return (
    <section>
      <SectionTitle
        action={
          plan.canEdit ? (
            <Link href={`/challenges/${data.challenge.id}?add=1&mode=suggest`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Lightbulb /> Öneri ekle
            </Link>
          ) : null
        }
      >
        Öneriler <span className="font-normal text-muted-foreground">({suggestions.length})</span>
      </SectionTitle>
      <p className="mb-4 text-sm text-muted-foreground">
        Aklına gelen ama henüz konuşmadığınız şeyler burada bekler. Listedeki başka biri kabul edip bir tura yerleştirir.
      </p>
      {suggestions.length === 0 ? (
        <EmptyState icon={<Lightbulb />} title="Bekleyen öneri yok">
          Bir şey aklına gelirse “Öneri ekle” ile not düş, unutulmasın.
        </EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {suggestions.map(({ card, canAccept }) => {
            const authoredByViewer = card.suggestedBy !== null && card.suggestedBy.id === data.viewerId;
            return (
              <EntryCard
                key={card.id}
                card={card}
                byline="suggested"
                showState={card.state.category !== "pending"}
                footer={
                  plan.canEdit ? (
                    <div className="mt-1 flex flex-col gap-2">
                      {canAccept ? (
                        <PlaceForm
                          entryId={card.id}
                          options={plan.options}
                          defaultIndex={plan.defaultIndex}
                          label={
                            <>
                              <CalendarPlus /> Plana ekle
                            </>
                          }
                        />
                      ) : (
                        <p className="text-xs text-muted-foreground">Listedeki başka birinin onayını bekliyor.</p>
                      )}
                      {plan.droppedStateId ? (
                        <ActionForm action={changeEntryStateAction} className="flex flex-col items-start gap-1" messageClassName="text-xs">
                          <input type="hidden" name="entryId" value={card.id} />
                          <SubmitButton name="stateId" value={plan.droppedStateId} size="sm" variant="ghost" className="text-muted-foreground">
                            {authoredByViewer ? (
                              <>
                                <Undo2 /> Geri çek
                              </>
                            ) : (
                              <>
                                <X /> Reddet
                              </>
                            )}
                          </SubmitButton>
                        </ActionForm>
                      ) : null}
                    </div>
                  ) : null
                }
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

/** Items dropped from the plan or rejected suggestions, folded away. */
export function DroppedPanel({ data }: { data: ChallengePageData }) {
  const dropped = data.plan?.dropped ?? [];
  if (dropped.length === 0) return null;
  return (
    <details className="group">
      <summary className="mb-3 flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
        <Badge tone="rose">Elenenler</Badge>
        <span className="text-muted-foreground">{dropped.length} · göster</span>
      </summary>
      <div className="grid gap-3 sm:grid-cols-2">
        {dropped.map((card) => (
          <EntryCard key={card.id} card={card} />
        ))}
      </div>
    </details>
  );
}
