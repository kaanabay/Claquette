"use client";

import { ArrowDownUp } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { NativeSelect } from "@/components/ui/fields";
import { toast } from "@/components/ui/toaster";
import type { ActionState } from "@/lib/action-state";
import { SORT_LABELS, type SortKey } from "../sort";

/**
 * "Sırala". With `save` (a list's owner) the choice becomes the list's own order; otherwise it
 * only changes this view, through `?sort=` in the address.
 */
export function SortSelect({
  value,
  options,
  save,
}: {
  value: SortKey;
  options: readonly SortKey[];
  save?: (sort: SortKey) => Promise<ActionState>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [shown, setShown] = useOptimistic(value);
  const [pending, startTransition] = useTransition();

  function change(sort: SortKey) {
    startTransition(async () => {
      setShown(sort);
      const params = new URLSearchParams(searchParams);
      if (save) {
        const result = await save(sort);
        if (result?.error) {
          toast(result.error, { isError: true });
          return;
        }
        // Saved as the list's own order: a one-off choice in the address would hide it.
        if (!params.has("sort")) return;
        params.delete("sort");
      } else {
        params.set("sort", sort);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  return (
    <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <ArrowDownUp className="size-4 shrink-0" aria-hidden />
      <NativeSelect
        value={shown}
        onChange={(event) => change(event.target.value as SortKey)}
        disabled={pending}
        aria-label="Sırala"
        className="h-8 w-auto py-0 pr-8 text-sm"
      >
        {options.map((key) => (
          <option key={key} value={key}>
            {SORT_LABELS[key]}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}
