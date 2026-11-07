"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { markProgressAction } from "../actions";
import { PROGRESS_STATUSES, progressLabel, type ProgressStatus } from "../labels";

/**
 * The viewer's own status on the item's page. Finishing (or passing on) a pool candidate alone takes
 * it out of the pool to "Tur dışı"; the notice says so and its "Geri al" puts both back.
 */
export function ProgressButtons({
  entryId,
  title,
  mediaType,
  status,
}: {
  entryId: string;
  title: string;
  mediaType: string;
  status: ProgressStatus | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function choose(next: ProgressStatus) {
    startTransition(async () => {
      const result = await markProgressAction(entryId, next);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError(null);
      if (!result.leftPool) return;
      const previous = result.previous ?? "planned";
      toast(`“${title}” havuzdan tur dışına geçti; diğerleri kendi zamanında bitirebilir.`, {
        action: {
          label: "Geri al",
          onClick: async () => {
            const undone = await markProgressAction(entryId, previous, { backToPool: true });
            if ("error" in undone) toast(undone.error, { isError: true });
          },
        },
      });
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {PROGRESS_STATUSES.map((value) => (
        <Button
          key={value}
          type="button"
          size="sm"
          variant={status === value ? "default" : "outline"}
          aria-pressed={status === value}
          disabled={pending}
          onClick={() => choose(value)}
        >
          {progressLabel(value, mediaType)}
        </Button>
      ))}
      {error ? (
        <p role="alert" className="w-full text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
