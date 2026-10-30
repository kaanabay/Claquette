"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { NativeSelect } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { placeEntryAction } from "@/modules/entries/actions";
import { finishedChoices, groupAudience } from "@/modules/entries/labels";
import { describeSlotOption } from "../domain/plan";
import type { SlotOption } from "../planning";

/**
 * Round picker + button: accepts a suggestion into a round, or moves a planned item. Into a
 * round that is already over it also asks who finished the item.
 */
export function PlaceForm({
  entryId,
  options,
  defaultIndex,
  label,
  currentIndex = null,
  askFinished = true,
  participantCount = 2,
}: {
  entryId: string;
  options: SlotOption[];
  defaultIndex: number | null;
  label: React.ReactNode;
  /** The round the item is in now (always selectable, even if "full" because of the item itself). */
  currentIndex?: number | null;
  /** False for a done item: it already says who finished it. */
  askFinished?: boolean;
  participantCount?: number;
}) {
  const [selected, setSelected] = useState(defaultIndex === null ? "" : String(defaultIndex));
  const chosen = options.find((option) => String(option.index) === selected);
  const askWho = askFinished && chosen?.timing === "past" && chosen.index !== currentIndex;

  return (
    <ActionForm action={placeEntryAction} className="flex flex-wrap items-center gap-2" messageClassName="text-xs">
      <input type="hidden" name="entryId" value={entryId} />
      <NativeSelect
        name="roundIndex"
        value={selected}
        onChange={(event) => setSelected(event.target.value)}
        aria-label="Tur"
        className="h-8 w-auto min-w-0 max-w-full flex-1 text-xs sm:flex-none"
      >
        <option value="" disabled>
          Tur seç
        </option>
        {options.map((option) => (
          <option key={option.index} value={option.index} disabled={option.isFull && option.index !== currentIndex}>
            {option.index === currentIndex ? `${option.label} · şu an burada` : describeSlotOption(option)}
          </option>
        ))}
      </NativeSelect>
      {askWho ? (
        <NativeSelect name="finished" defaultValue="all" aria-label="Kim bitirdi?" className="h-8 w-auto text-xs">
          {finishedChoices(groupAudience(participantCount)).map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </NativeSelect>
      ) : null}
      <SubmitButton size="sm" variant="outline">
        {label}
      </SubmitButton>
    </ActionForm>
  );
}
