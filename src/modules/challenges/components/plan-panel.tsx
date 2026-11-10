import { CalendarPlus, Lightbulb, Plus, Undo2, X } from "lucide-react";
import Link from "next/link";
import { Fold, ShowMore } from "@/components/fold";
import { FilterEmpty, FilteredCount, FilterGroup } from "@/components/item-filter";
import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import { changeEntryStateAction } from "@/modules/entries/actions";
import { EntryCard } from "@/modules/entries/components/entry-card";
import { entryFilterKey } from "@/modules/entries/filter-key";
import { TakeOffRoundButton } from "@/modules/entries/components/off-round-buttons";
import { formatTitle } from "@/modules/media/titles";
import { describeRoundSummary, summarizeRound } from "@/modules/entries/tracking";
import type { ChallengePageData } from "../queries";
import { daysLeft } from "../timeline";
import { PlaceForm } from "./place-form";

type Plan = NonNullable<ChallengePageData["plan"]>;
type PlanSlotView = Plan["slots"][number];

/** A round that is over while someone is still to finish one of its items. */
const isOverdue = (slot: PlanSlotView) => slot.entries.some((card) => card.tracking?.overdue);

const keysOf = (slots: readonly PlanSlotView[]) => slots.flatMap((slot) => slot.entries.map((card) => entryFilterKey(card)));

/**
 * The rounds of a planning list. What is on now (and rounds over with someone still to go) and the
 * next round are in sight; rounds that are over and those further ahead fold away, newest first.
 */
export function PlanPanel({ data }: { data: ChallengePageData }) {
  const plan = data.plan;
  if (!plan) return null;
  const past = plan.slots.filter((slot) => slot.timing === "past" && !isOverdue(slot)).reverse();
  const now = plan.slots.filter((slot) => slot.timing === "current" || (slot.timing === "past" && isOverdue(slot)));
  // The next round stays in sight: a list that hasn't started yet is planned from there.
  const [next, ...later] = plan.slots.filter((slot) => slot.timing === "future");
  const shown = next ? [...now, next] : now;
  const filled = (slots: readonly PlanSlotView[]) => slots.filter((slot) => slot.entries.length > 0).length;

  return (
    <Fold remember="plan" title="Plan">
      {past.length > 0 ? (
        <Fold
          level={3}
          defaultOpen={false}
          remember="plan-past"
          items={keysOf(past)}
          className="mb-4"
          title={
            <>
              Geçmiş turlar{" "}
              <span className="font-normal text-muted-foreground">
                ({past.length}) · {filled(past)} dolu
              </span>
            </>
          }
        >
          <ShowMore initial={6} as="ol" className="flex flex-col gap-3">
            {past.map((slot) => (
              <SlotRow key={slot.index} slot={slot} data={data} />
            ))}
          </ShowMore>
        </Fold>
      ) : null}
      {shown.length > 0 ? (
        <ol className="flex flex-col gap-3">
          {shown.map((slot) => (
            <SlotRow key={slot.index} slot={slot} data={data} />
          ))}
        </ol>
      ) : past.length === 0 ? (
        <EmptyState icon={<CalendarPlus />} title="Henüz tur yok">
          Liste başladığında turlar burada görünecek. Bu arada öneri ekleyebilirsiniz.
        </EmptyState>
      ) : null}
      {later.length > 0 ? (
        <Fold
          level={3}
          defaultOpen={false}
          remember="plan-later"
          items={keysOf(later)}
          className="mt-4"
          title={
            <>
              Sonraki turlar{" "}
              <span className="font-normal text-muted-foreground">
                ({later.length}) · {filled(later)} dolu
              </span>
            </>
          }
        >
          <ShowMore initial={6} as="ol" className="flex flex-col gap-3">
            {later.map((slot) => (
              <SlotRow key={slot.index} slot={slot} data={data} />
            ))}
          </ShowMore>
        </Fold>
      ) : null}
    </Fold>
  );
}

function SlotRow({ slot, data }: { slot: PlanSlotView; data: ChallengePageData }) {
  const plan = data.plan!;
  const remaining = slot.timing === "current" ? daysLeft(slot.endsOn, data.today) : null;
  // "1/2 bitti" while the round is on; once it is over, also who is still to finish.
  const summary =
    slot.timing === "future"
      ? null
      : describeRoundSummary(
          summarizeRound(slot.entries.map((card) => ({ category: card.state.category, tracking: card.tracking }))),
          data.viewerId,
          slot.timing === "past",
        );
  const status = (slot.timing === "current" ? ["Bu tur", remaining, summary] : slot.timing === "past" ? ["Geçti", summary] : ["Sırada"])
    .filter(Boolean)
    .join(" · ");
  const canAdd = plan.canEdit && !slot.isFull;

  return (
    // While the page is filtered by type, only rounds holding such an item show.
    <FilterGroup items={slot.entries.map((card) => entryFilterKey(card))}>
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
            <p
              className={cn(
                "mt-0.5 text-xs",
                slot.timing === "current" ? "font-medium text-foreground" : "text-muted-foreground",
                isOverdue(slot) && "text-amber-700 dark:text-amber-300",
              )}
            >
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
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {slot.entries.map((card) => (
              <EntryCard key={card.id} card={card} showRound={false} byline="added" className="shadow-none" />
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{slot.timing === "past" ? "Bu tura bir şey girilmemiş." : "Henüz belirlenmedi."}</p>
        )}
      </li>
    </FilterGroup>
  );
}

/** Ideas waiting for a round. Someone other than the author accepts them into the plan. */
export function SuggestionsPanel({ data }: { data: ChallengePageData }) {
  const plan = data.plan;
  if (!plan) return null;
  const { suggestions } = plan;
  const participantCount = data.participants.filter((participant) => participant.isActive).length;
  const keys = suggestions.map(({ card }) => entryFilterKey(card));

  return (
    <Fold
      remember="suggestions"
      title={
        <>
          Öneriler{" "}
          <span className="font-normal text-muted-foreground">
            (<FilteredCount items={keys} />)
          </span>
        </>
      }
      action={
        plan.canEdit ? (
          <Link href={`/challenges/${data.challenge.id}?add=1&mode=suggest`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Lightbulb /> Öneri ekle
          </Link>
        ) : null
      }
    >
      <p className="mb-4 text-sm text-muted-foreground">
        Aklına gelen ama henüz konuşmadığınız şeyler burada bekler. Listedeki başka biri kabul edip bir tura yerleştirir.
      </p>
      {suggestions.length === 0 ? (
        <EmptyState icon={<Lightbulb />} title="Bekleyen öneri yok">
          Bir şey aklına gelirse “Öneri ekle” ile not düş, unutulmasın.
        </EmptyState>
      ) : (
        <ShowMore initial={6} items={keys} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                          participantCount={participantCount}
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
                      <TakeOffRoundButton entryId={card.id} title={formatTitle(card.media)} variant="ghost" className="self-start" />
                    </div>
                  ) : null
                }
              />
            );
          })}
        </ShowMore>
      )}
      <FilterEmpty items={keys} />
    </Fold>
  );
}

/** Items dropped from the plan or rejected suggestions, folded away. */
export function DroppedPanel({ data }: { data: ChallengePageData }) {
  const dropped = data.plan?.dropped ?? [];
  if (dropped.length === 0) return null;
  const keys = dropped.map((card) => entryFilterKey(card));
  return (
    <Fold
      defaultOpen={false}
      remember="dropped"
      items={keys}
      title={
        <>
          <Badge tone="rose">Elenenler</Badge>
          <span className="text-base font-normal text-muted-foreground">
            <FilteredCount items={keys} />
          </span>
        </>
      }
    >
      <ShowMore initial={6} items={keys} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {dropped.map((card) => (
          <EntryCard key={card.id} card={card} />
        ))}
      </ShowMore>
    </Fold>
  );
}
