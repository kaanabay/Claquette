"use client";

import { Info, Sparkles } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Input, Label, NativeSelect, Textarea } from "@/components/ui/fields";
import { FieldError, FormMessage } from "@/components/ui/form-message";
import { FreshAfterSubmit } from "@/components/ui/fresh-after-submit";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFieldId } from "@/components/ui/use-field-id";
import { useFormAction } from "@/components/ui/use-form-action";
import { formatDate } from "@/lib/dates";
import { toneClass } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { createChallengeAction } from "../actions";
import { CADENCE_PRESETS } from "../domain/cadence";
import {
  configFieldName,
  defaultConfig,
  STRATEGIES,
  type AnyStrategy,
  type ConfigField,
} from "../domain/strategies";

type Props = {
  groupId: string;
  today: string;
  members: { userId: string; name: string; username: string | null }[];
  mediaTypes: { slug: string; label: string; icon: string; sources: string[] }[];
  workflows: { id: string; name: string; description: string | null }[];
};

const UNIT_OPTIONS = [
  { value: "day", label: "gün" },
  { value: "week", label: "hafta" },
  { value: "month", label: "ay" },
  { value: "year", label: "yıl" },
];

const pill =
  "flex cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm transition-colors hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring";

export function ChallengeForm(props: Props) {
  return (
    <FreshAfterSubmit>
      <ChallengeFormInner {...props} />
    </FreshAfterSubmit>
  );
}

function ChallengeFormInner({ groupId, today, members, mediaTypes, workflows }: Props) {
  const { state, pending, formProps } = useFormAction(createChallengeAction);
  const fid = useFieldId();
  const [preset, setPreset] = useState<string>("monthly");
  const [strategyKey, setStrategyKey] = useState<string>(STRATEGIES[0].key);
  const [startsOn, setStartsOn] = useState(today);
  const errors = state?.fieldErrors ?? {};
  const strategy = (STRATEGIES as readonly AnyStrategy[]).find((s) => s.key === strategyKey) ?? STRATEGIES[0];
  const defaults = defaultConfig(strategy);
  // Only planning rules can take items before the first round starts.
  const waitsForStart = Boolean(startsOn) && startsOn > today && !strategy.planning;

  return (
    <form {...formProps} className="flex flex-col gap-6">
      <input type="hidden" name="groupId" value={groupId} />

      <Card>
        <CardHeader>
          <CardTitle>Temel bilgiler</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={fid("title")}>Başlık</Label>
            <Input id={fid("title")} name="title" placeholder="ör. Auteur Sineması" required maxLength={80} />
            <FieldError errors={errors.title} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={fid("description")}>Açıklama (isteğe bağlı)</Label>
            <Textarea id={fid("description")} name="description" rows={2} maxLength={500} placeholder="Kurallar, tema, notlar…" />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">İçerik türleri</legend>
            <div className="flex flex-wrap gap-2">
              {mediaTypes.map((type) => (
                <label key={type.slug} className={pill}>
                  <Checkbox name="mediaTypes" value={type.slug} className="sr-only" />
                  <span aria-hidden>{type.icon}</span> {type.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Hiçbirini seçmezsen tüm türler kabul edilir.</p>
          </fieldset>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zaman</CardTitle>
          <CardDescription>Her periyot bir “tur”dur. Süresiz listelerde turu siz ilerletirsiniz.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {[...CADENCE_PRESETS, { key: "custom", label: "Özel" }].map((option) => (
              <label key={option.key} className={pill}>
                <input
                  type="radio"
                  name="cadencePreset"
                  value={option.key}
                  checked={preset === option.key}
                  onChange={() => setPreset(option.key)}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>
          {preset === "custom" ? (
            <div className="flex items-end gap-2">
              <div className="flex w-24 flex-col gap-2">
                <Label htmlFor={fid("cadenceInterval")}>Her</Label>
                <Input id={fid("cadenceInterval")} name="cadenceInterval" type="number" min={1} max={365} defaultValue={10} />
              </div>
              <NativeSelect name="cadenceUnit" defaultValue="day" className="w-32" aria-label="Birim">
                {UNIT_OPTIONS.map((unit) => (
                  <option key={unit.value} value={unit.value}>
                    {unit.label}
                  </option>
                ))}
              </NativeSelect>
              <span className="pb-2 text-sm text-muted-foreground">bir</span>
            </div>
          ) : null}
          <FieldError errors={errors.cadenceInterval} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={fid("startsOn")}>Başlangıç</Label>
              <Input
                id={fid("startsOn")}
                name="startsOn"
                type="date"
                value={startsOn}
                onChange={(event) => setStartsOn(event.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">Turlar bu tarihten sayılır (ör. ayın 1’i ya da bir Pazartesi). Geçmiş bir tarih de olur; geçmiş turları sonradan doldurursunuz.</p>
              <FieldError errors={errors.startsOn} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={fid("endsOn")}>Bitiş (isteğe bağlı)</Label>
              <Input id={fid("endsOn")} name="endsOn" type="date" />
              <p className="text-xs text-muted-foreground">Boş bırakırsan liste süresiz devam eder.</p>
              <FieldError errors={errors.endsOn} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Seçim kuralı</CardTitle>
          <CardDescription>Listeye neyin, kim tarafından, nasıl gireceğini belirler.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {STRATEGIES.map((option) => (
              <label
                key={option.key}
                className={cn(
                  "flex cursor-pointer flex-col gap-1 rounded-xl border p-4 transition-colors hover:bg-muted",
                  strategyKey === option.key && "border-primary bg-accent",
                )}
              >
                <input
                  type="radio"
                  name="strategy"
                  value={option.key}
                  checked={strategyKey === option.key}
                  onChange={() => setStrategyKey(option.key)}
                  className="sr-only"
                />
                <span className="font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.summary}</span>
              </label>
            ))}
          </div>
          {waitsForStart ? (
            <p className={cn("flex items-start gap-2 rounded-xl p-3 text-sm ring-1 ring-inset", toneClass("amber"))}>
              <Info className="mt-0.5 size-4 shrink-0" />
              Liste {formatDate(startsOn)} tarihinde başlıyor. Bu kuralda o güne kadar öge eklenemez; turları önceden
              doldurmak istiyorsan “Birlikte belirliyoruz”u seç.
            </p>
          ) : null}
          {/* key: remount with the new strategy's defaults when it changes */}
          <div key={strategy.key} className="grid gap-4 sm:grid-cols-2">
            {strategy.configFields.map((field) => (
              <ConfigFieldInput
                key={field.name}
                strategyKey={strategy.key}
                field={field}
                defaultValue={defaults[field.name]}
                error={errors[configFieldName(strategy.key, field.name)]}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Katılımcılar</CardTitle>
          <CardDescription>
            Sırayla öneride liste sırası rotasyon sırasıdır. Sonradan katılanlar sıranın sonuna eklenir.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {members.map((member) => (
              <label key={member.userId} className={pill}>
                <Checkbox name="participants" value={member.userId} defaultChecked className="sr-only" />
                {member.name}
                {member.username ? <span className="text-xs text-muted-foreground">@{member.username}</span> : null}
              </label>
            ))}
          </div>
          <FieldError errors={errors.participants} />
          {strategy.key === "rotation" ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="shuffle" /> Sırayı rastgele belirle
            </label>
          ) : null}
        </CardContent>
      </Card>

      {workflows.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Durum akışı</CardTitle>
            <CardDescription>Ögelerin geçeceği adımlar (ör. Önerildi → Kabul Edildi → Tamamlandı).</CardDescription>
          </CardHeader>
          <CardContent>
            <NativeSelect name="workflowId" defaultValue={workflows[0].id}>
              {workflows.map((workflow) => (
                <option key={workflow.id} value={workflow.id}>
                  {workflow.name}
                </option>
              ))}
            </NativeSelect>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3">
        <FormMessage state={state} />
        <SubmitButton pending={pending} size="lg" className="self-start">
          <Sparkles /> Listeyi oluştur
        </SubmitButton>
      </div>
    </form>
  );
}

function ConfigFieldInput({
  strategyKey,
  field,
  defaultValue,
  error,
}: {
  strategyKey: string;
  field: ConfigField;
  defaultValue: unknown;
  error?: string[];
}) {
  const fid = useFieldId();
  const name = configFieldName(strategyKey, field.name);
  const help = field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null;

  if (field.type === "boolean") {
    return (
      <label className="flex items-start gap-2 text-sm sm:col-span-2">
        <Checkbox name={name} defaultChecked={Boolean(defaultValue)} className="mt-0.5" />
        <span className="flex flex-col gap-0.5">
          {field.label}
          {help}
        </span>
      </label>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={fid(name)}>{field.label}</Label>
      {field.type === "select" ? (
        <NativeSelect id={fid(name)} name={name} defaultValue={String(defaultValue ?? "")}>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      ) : (
        <Input id={fid(name)} name={name} type="number" min={field.min} max={field.max} defaultValue={Number(defaultValue ?? field.min)} />
      )}
      {help}
      <FieldError errors={error} />
    </div>
  );
}
