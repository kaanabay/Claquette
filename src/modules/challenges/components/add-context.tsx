"use client";

import { useRouter } from "next/navigation";
import { Label, NativeSelect } from "@/components/ui/fields";
import { useFieldId } from "@/components/ui/use-field-id";
import type { AddContext } from "../queries";

const GROUPS: { timing: AddContext["rounds"][number]["timing"]; label: string }[] = [
  { timing: "pool", label: "Havuz" },
  { timing: "current", label: "Bu tur" },
  { timing: "future", label: "Sıradaki turlar" },
  { timing: "past", label: "Geçmiş turlar" },
];

/**
 * Where an addition goes and (group admins) whose it is. Each choice is a link: the panel below is
 * worked out again for it, so these come first, before anything is picked.
 */
export function AddContextBar({ rounds, people }: Pick<AddContext, "rounds" | "people">) {
  const router = useRouter();
  const fid = useFieldId();
  if (rounds.length <= 1 && people.length <= 1) return null;
  const go = (href: string | undefined) => {
    if (href) router.replace(href, { scroll: false });
  };
  const selectedRound = rounds.find((round) => round.selected)?.key ?? "";
  const selectedPerson = people.find((person) => person.selected)?.id ?? "";

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {rounds.length > 1 ? (
        <div className="flex flex-col gap-1.5 sm:flex-1">
          <Label htmlFor={fid("context-round")}>Hangi tur?</Label>
          <NativeSelect
            key={selectedRound}
            id={fid("context-round")}
            defaultValue={selectedRound}
            onChange={(event) => go(rounds.find((round) => round.key === event.target.value)?.href)}
          >
            {selectedRound === "" ? (
              <option value="" disabled>
                Bir tur seç
              </option>
            ) : null}
            {GROUPS.map((group) => {
              const options = rounds.filter((round) => round.timing === group.timing);
              return options.length > 0 ? (
                <optgroup key={group.timing} label={group.label}>
                  {options.map((round) => (
                    <option key={round.key} value={round.key}>
                      {round.label}
                    </option>
                  ))}
                </optgroup>
              ) : null;
            })}
          </NativeSelect>
        </div>
      ) : null}
      {people.length > 1 ? (
        <div className="flex flex-col gap-1.5 sm:flex-1">
          <Label htmlFor={fid("context-as")}>Kimin adına?</Label>
          <NativeSelect
            key={selectedPerson}
            id={fid("context-as")}
            defaultValue={selectedPerson}
            onChange={(event) => go(people.find((person) => person.id === event.target.value)?.href)}
          >
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </NativeSelect>
          <p className="text-xs text-muted-foreground">Yönetici olarak başkası adına ekleyebilirsin; öge onun eklediği gibi görünür, kimin girdiği akışta yazar.</p>
        </div>
      ) : null}
    </div>
  );
}
