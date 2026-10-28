import { ActionForm } from "@/components/ui/action-form";
import { NativeSelect } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { placeEntryAction } from "@/modules/entries/actions";
import { describeSlotOption } from "../domain/plan";
import type { SlotOption } from "../planning";

/** Round picker + button: accepts a suggestion into a round, or moves a planned item. */
export function PlaceForm({
  entryId,
  options,
  defaultIndex,
  label,
  currentIndex = null,
}: {
  entryId: string;
  options: SlotOption[];
  defaultIndex: number | null;
  label: React.ReactNode;
  /** The round the item is in now (always selectable, even if "full" because of the item itself). */
  currentIndex?: number | null;
}) {
  return (
    <ActionForm action={placeEntryAction} className="flex flex-wrap items-center gap-2" messageClassName="text-xs">
      <input type="hidden" name="entryId" value={entryId} />
      <NativeSelect name="roundIndex" defaultValue={defaultIndex ?? ""} aria-label="Tur" className="h-8 w-auto min-w-0 max-w-full flex-1 text-xs sm:flex-none">
        <option value="" disabled>
          Tur seç
        </option>
        {options.map((option) => (
          <option key={option.index} value={option.index} disabled={option.isFull && option.index !== currentIndex}>
            {option.index === currentIndex ? `${option.label} · şu an burada` : describeSlotOption(option)}
          </option>
        ))}
      </NativeSelect>
      <SubmitButton size="sm" variant="outline">
        {label}
      </SubmitButton>
    </ActionForm>
  );
}
