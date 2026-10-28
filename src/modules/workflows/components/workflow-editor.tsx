"use client";

import { ArrowDown, ArrowUp, Plus, Save, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, NativeSelect } from "@/components/ui/fields";
import { FieldError, FormMessage } from "@/components/ui/form-message";
import { FreshAfterSubmit } from "@/components/ui/fresh-after-submit";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFieldId } from "@/components/ui/use-field-id";
import { useFormAction } from "@/components/ui/use-form-action";
import { dotClass, TONES, type Tone } from "@/lib/tones";
import { createWorkflowAction } from "../actions";
import { CATEGORY_LABELS, STATE_CATEGORIES, type StateCategory } from "../domain";

type Step = { id: number; label: string; category: StateCategory; color: Tone };

const COLOR_LABELS: Record<Tone, string> = {
  slate: "Gri",
  amber: "Sarı",
  sky: "Mavi",
  emerald: "Yeşil",
  rose: "Kırmızı",
  violet: "Mor",
};

const STARTER: Omit<Step, "id">[] = [
  { label: "Önerildi", category: "pending", color: "amber" },
  { label: "Kabul Edildi", category: "active", color: "sky" },
  { label: "Okunuyor / İzleniyor", category: "active", color: "violet" },
  { label: "Tamamlandı", category: "done", color: "emerald" },
  { label: "Reddedildi", category: "dropped", color: "rose" },
];

export function WorkflowEditor({ groupId }: { groupId: string }) {
  return (
    <FreshAfterSubmit>
      <WorkflowEditorInner groupId={groupId} />
    </FreshAfterSubmit>
  );
}

function WorkflowEditorInner({ groupId }: { groupId: string }) {
  const { state, pending, formProps } = useFormAction(createWorkflowAction);
  const fid = useFieldId();
  const [steps, setSteps] = useState<Step[]>(() => STARTER.map((step, id) => ({ ...step, id })));
  const [nextId, setNextId] = useState(STARTER.length);

  const update = (id: number, patch: Partial<Step>) =>
    setSteps((current) => current.map((step) => (step.id === id ? { ...step, ...patch } : step)));
  const move = (index: number, delta: number) =>
    setSteps((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });

  return (
    <form {...formProps} className="flex flex-col gap-6">
      <input type="hidden" name="groupId" value={groupId} />
      <input
        type="hidden"
        name="steps"
        value={JSON.stringify(steps.map(({ label, category, color }) => ({ label, category, color })))}
      />

      <Card>
        <CardHeader>
          <CardTitle>Akış</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor={fid("name")}>Ad</Label>
            <Input id={fid("name")} name="name" required maxLength={60} placeholder="ör. Kitap kulübü akışı" />
            <FieldError errors={state?.fieldErrors?.name} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={fid("description")}>Açıklama (isteğe bağlı)</Label>
            <Input id={fid("description")} name="description" maxLength={200} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Adımlar</CardTitle>
          <CardDescription>
            Sıra, ögenin geçeceği yolu gösterir. “Tür”, uygulamanın adımı nasıl yorumlayacağını belirler: yeni öneriler ilk
            “Karar bekliyor” adımında başlar, herkes bitirince öge ilk “Tamamlandı” adımına geçer.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {steps.map((step, index) => (
            <div key={step.id} className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center">
              <span className="flex w-10 items-center gap-1.5 text-sm text-muted-foreground">
                {index + 1}.
                <span className={`size-2.5 rounded-full ${dotClass(step.color)}`} aria-hidden />
              </span>
              <Input
                value={step.label}
                onChange={(event) => update(step.id, { label: event.target.value })}
                maxLength={30}
                required
                aria-label={`${index + 1}. adımın adı`}
                className="sm:flex-1"
              />
              <NativeSelect
                value={step.category}
                onChange={(event) => update(step.id, { category: event.target.value as StateCategory })}
                aria-label={`${index + 1}. adımın türü`}
                className="sm:w-44"
              >
                {STATE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                value={step.color}
                onChange={(event) => update(step.id, { color: event.target.value as Tone })}
                aria-label={`${index + 1}. adımın rengi`}
                className="sm:w-28"
              >
                {(Object.keys(TONES) as Tone[]).map((tone) => (
                  <option key={tone} value={tone}>
                    {COLOR_LABELS[tone]}
                  </option>
                ))}
              </NativeSelect>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Yukarı taşı">
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => move(index, 1)}
                  disabled={index === steps.length - 1}
                  aria-label="Aşağı taşı"
                >
                  <ArrowDown />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSteps((current) => current.filter((item) => item.id !== step.id))}
                  disabled={steps.length <= 2}
                  aria-label="Adımı sil"
                >
                  <X />
                </Button>
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            disabled={steps.length >= 12}
            onClick={() => {
              setSteps((current) => [...current, { id: nextId, label: "", category: "active", color: "slate" }]);
              setNextId((id) => id + 1);
            }}
          >
            <Plus /> Adım ekle
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <FormMessage state={state} />
        <SubmitButton pending={pending} size="lg" className="self-start">
          <Save /> Akışı kaydet
        </SubmitButton>
      </div>
    </form>
  );
}
