"use client";

import { CalendarCheck, Lightbulb, Send } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, NativeSelect, Textarea } from "@/components/ui/fields";
import { FieldError, FormMessage } from "@/components/ui/form-message";
import { FreshAfterSubmit } from "@/components/ui/fresh-after-submit";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFieldId } from "@/components/ui/use-field-id";
import { useFormAction } from "@/components/ui/use-form-action";
import { cn } from "@/lib/utils";
import { describeSlotOption, type SlotTiming } from "@/modules/challenges/domain/plan";
import { suggestEntryAction } from "@/modules/entries/actions";
import { finishedChoices } from "@/modules/entries/labels";
import { itemKey, type ExistingMedia } from "../keys";
import { formatTitle } from "../titles";
import { pickFromCatalog, type CatalogPick, type MediaTypeOption } from "../types";
import { MediaPicker, useBasket } from "./media-picker";

export type RoundChoice = { index: number; label: string; timing: SlotTiming; isFull: boolean };

type Props = {
  challengeId: string;
  mediaTypes: MediaTypeOption[];
  targets: { id: string | null; name: string }[];
  placement: "round" | "pool" | "plan";
  plan?: {
    options: RoundChoice[];
    defaultIndex: number | null;
    defaultMode: "plan" | "suggest";
    /** Items per round; null = no limit. */
    capacity: number | null;
    participantCount: number;
  } | null;
  picks?: CatalogPick[];
  preselected?: CatalogPick | null;
  existing?: ExistingMedia;
  /** Suggestions left for now (e.g. this round's quota); null = no limit. */
  maxItems?: number | null;
  /** The user just opened the form: start in the search box. */
  autoFocus?: boolean;
};

export function SuggestForm(props: Props) {
  return (
    <FreshAfterSubmit>
      <SuggestFormInner {...props} />
    </FreshAfterSubmit>
  );
}

const pill =
  "flex flex-1 cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring";

// [one item, several items (after the count)]
const SUBMIT_LABELS = {
  plan: ["Plana ekle", "ögeyi plana ekle"],
  suggest: ["Öneri olarak ekle", "ögeyi öneri olarak ekle"],
  pool: ["Havuza ekle", "ögeyi havuza ekle"],
  round: ["Öneriyi gönder", "öneriyi gönder"],
} as const;

function SuggestFormInner({
  challengeId,
  mediaTypes,
  targets,
  placement,
  plan,
  picks,
  preselected,
  existing,
  maxItems = null,
  autoFocus = false,
}: Props) {
  const { state, pending, formProps } = useFormAction(suggestEntryAction);
  const fid = useFieldId();
  // An item handed over from a personal list may already be here.
  const preselectedIsIn = preselected ? (existing?.keys.includes(itemKey(preselected.mediaItemId)) ?? false) : false;
  const [picked, setPicked] = useBasket(existing, () => (preselected && !preselectedIsIn ? [pickFromCatalog(preselected)] : []));
  const [manualFilled, setManualFilled] = useState(false);
  const [manualKey, setManualKey] = useState(0);
  const [handled, setHandled] = useState(state);
  const [planMode, setPlanMode] = useState<"plan" | "suggest">(plan?.defaultMode ?? "suggest");
  const [roundIndex, setRoundIndex] = useState<string>(plan?.defaultIndex !== null && plan?.defaultIndex !== undefined ? String(plan.defaultIndex) : "");

  // Rounds filled up meanwhile (e.g. by the part of a batch that went in): move on to a free one,
  // since a disabled option isn't submitted.
  const [seenOptions, setSeenOptions] = useState(plan?.options);
  if (plan && plan.options !== seenOptions) {
    setSeenOptions(plan.options);
    const selected = plan.options.find((option) => String(option.index) === roundIndex);
    if (selected?.isFull) {
      const next = plan.options.find((option) => option.index > selected.index && !option.isFull);
      setRoundIndex(next ? String(next.index) : "");
    }
  }

  // Some items failed (the rest redirects away): keep only those, so they can be fixed or dropped.
  if (state !== handled) {
    setHandled(state);
    const added = state?.added ?? [];
    if (added.length > 0) {
      setPicked((current) => current.filter((item) => !added.includes(item.key)));
      if (added.includes("manual")) setManualKey((value) => value + 1);
    }
  }

  const errors = state?.fieldErrors ?? {};
  const isPlan = placement === "plan";
  const planning = isPlan && plan ? plan : null;
  const chosen = planning?.options.find((option) => String(option.index) === roundIndex);
  const intoPlan = planning !== null && planMode === "plan";
  const count = picked.length + (manualFilled ? 1 : 0);
  const [one, many] = SUBMIT_LABELS[isPlan ? (intoPlan ? "plan" : "suggest") : placement];

  return (
    <form {...formProps} className="flex flex-col gap-6">
      <input type="hidden" name="challengeId" value={challengeId} />

      <Card>
        <CardHeader>
          <CardTitle>{isPlan ? "Ne ekliyorsun?" : "Ne öneriyorsun?"}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {preselected && preselectedIsIn ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">“{formatTitle(preselected)}” zaten bu listede.</p>
          ) : null}
          <MediaPicker
            mediaTypes={mediaTypes}
            errors={errors}
            picked={picked}
            onPickedChange={setPicked}
            onManualChange={setManualFilled}
            maxItems={maxItems}
            picks={picks}
            existing={existing}
            manualKey={manualKey}
            autoFocus={autoFocus}
          />
        </CardContent>
      </Card>

      {isPlan ? (
        <Card>
          <CardHeader>
            <CardTitle>Nereye?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <input type="hidden" name="recipientId" value="" />
            <input type="hidden" name="planMode" value={intoPlan ? "plan" : "suggest"} />
            <div className="flex flex-col gap-2 sm:flex-row" role="radiogroup" aria-label="Ekleme şekli">
              {planning && planning.options.length > 0 ? (
                <label className={pill}>
                  <input
                    type="radio"
                    name="planChoice"
                    checked={planMode === "plan"}
                    onChange={() => setPlanMode("plan")}
                    className="sr-only"
                  />
                  <CalendarCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>
                    <span className="block font-medium">Anlaştık, plana ekle</span>
                    <span className="block text-xs text-muted-foreground">Seçtiğin tura doğrudan girer.</span>
                  </span>
                </label>
              ) : null}
              <label className={pill}>
                <input
                  type="radio"
                  name="planChoice"
                  checked={!intoPlan}
                  onChange={() => setPlanMode("suggest")}
                  className="sr-only"
                />
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  <span className="block font-medium">Öneri olarak ekle</span>
                  <span className="block text-xs text-muted-foreground">Diğerleri kabul edip bir tura yerleştirene kadar bekler.</span>
                </span>
              </label>
            </div>

            {intoPlan && planning ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor={fid("roundIndex")}>{count > 1 ? "Başlangıç turu" : "Tur"}</Label>
                <NativeSelect
                  id={fid("roundIndex")}
                  name="roundIndex"
                  value={roundIndex}
                  onChange={(event) => setRoundIndex(event.target.value)}
                  required
                >
                  <option value="" disabled>
                    Bir tur seç
                  </option>
                  {planning.options.map((option) => (
                    <option key={option.index} value={option.index} disabled={option.isFull}>
                      {describeSlotOption(option)}
                    </option>
                  ))}
                </NativeSelect>
                {count > 1 && chosen ? (
                  <p className="text-xs text-muted-foreground">
                    {planning.capacity === null
                      ? `${count} ögenin hepsi «${chosen.label}» turuna girer.`
                      : `${count} öge «${chosen.label}» turundan başlayarak boş yeri olan turlara sırayla yerleşir.`}
                  </p>
                ) : null}
                <FieldError errors={errors.roundIndex} />
              </div>
            ) : null}
            {intoPlan && planning && chosen?.timing === "past" ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-medium">Bu tur geçti. Kim bitirdi?</legend>
                <div className="flex flex-wrap gap-2">
                  {finishedChoices(planning.participantCount <= 1).map((choice, index) => (
                    <label
                      key={choice.value}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent"
                    >
                      <input type="radio" name="finished" value={choice.value} defaultChecked={index === 0} className="accent-primary" />
                      {choice.label}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Öge, ait olduğu herkes bitirince “Tamamlandı” olur; bitirmeyen varsa “Zamanı geçti” diye görünür.
                </p>
              </fieldset>
            ) : null}
            <PitchField intoPlan={intoPlan} errors={errors.pitch} many={count > 1} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{placement === "pool" ? "Havuza ekle" : "Kime?"}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {placement === "pool" ? (
              <p className="text-sm text-muted-foreground">Öneri ortak havuza girer; tur seçimi kurallara göre yapılır.</p>
            ) : null}
            {targets.length === 1 ? (
              <>
                <input type="hidden" name="recipientId" value={targets[0].id ?? ""} />
                {placement !== "pool" ? (
                  <p className="text-sm">
                    Alıcı: <span className="font-medium">{targets[0].name}</span>
                  </p>
                ) : null}
              </>
            ) : (
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Alıcı">
                {targets.map((target, index) => (
                  <label
                    key={target.id ?? "group"}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent"
                  >
                    <input type="radio" name="recipientId" value={target.id ?? ""} defaultChecked={index === 0} className="accent-primary" />
                    {target.name}
                  </label>
                ))}
              </div>
            )}
            <PitchField intoPlan={false} errors={errors.pitch} many={count > 1} />
          </CardContent>
        </Card>
      )}

      {/* On phones the button stays in reach while picks are waiting (it would be far below the results). */}
      <div className={cn("flex flex-col gap-3", count > 0 && "max-sm:sticky max-sm:bottom-0 max-sm:z-20 max-sm:-mx-4 max-sm:border-t max-sm:bg-background/95 max-sm:px-4 max-sm:py-3 max-sm:backdrop-blur")}>
        <FormMessage state={state} />
        <SubmitButton
          pending={pending}
          size="lg"
          className="self-start max-sm:self-stretch"
          disabled={count === 0 || (intoPlan && roundIndex === "")}
        >
          <Send /> {count > 1 ? `${count} ${many}` : one}
        </SubmitButton>
      </div>
    </form>
  );
}

/** One note for one item: with several items picked it's set aside (kept, not sent). */
function PitchField({ intoPlan, errors, many }: { intoPlan: boolean; errors?: string[]; many: boolean }) {
  const fid = useFieldId();
  return (
    <>
      <div className={cn("flex flex-col gap-2", many && "hidden")}>
        <Label htmlFor={fid("pitch")}>{intoPlan ? "Not (isteğe bağlı)" : "Neden öneriyorsun? (isteğe bağlı)"}</Label>
        <Textarea
          id={fid("pitch")}
          name="pitch"
          rows={3}
          maxLength={500}
          disabled={many}
          placeholder={intoPlan ? "ör. Yönetmenin ilk filmi" : "Spoiler vermeden ikna et 🙂"}
        />
        <FieldError errors={errors} />
      </div>
      {many ? (
        <p className="text-xs text-muted-foreground">Birden çok öge eklerken not yazılmaz; her ögenin sayfasından ayrıca not ekleyebilirsin.</p>
      ) : null}
    </>
  );
}
