"use client";

import { Check } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { markProgressAction } from "../actions";
import { progressLabel, type ProgressStatus } from "../labels";

/** One tap marks an item finished for the viewer, or takes it back; the notice offers "Geri al". */
export function ProgressToggle({
  entryId,
  title,
  mediaType,
  status,
  className,
}: {
  entryId: string;
  title: string;
  mediaType: string;
  status: ProgressStatus | null;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const done = status === "completed";
  const label = progressLabel("completed", mediaType);

  function save(next: ProgressStatus, message: string) {
    startTransition(async () => {
      const result = await markProgressAction(entryId, next);
      if ("error" in result) {
        toast(result.error, { isError: true });
        return;
      }
      const previous = result.previous ?? "planned";
      toast(message, {
        action: {
          label: "Geri al",
          onClick: async () => {
            const undone = await markProgressAction(entryId, previous);
            if ("error" in undone) toast(undone.error, { isError: true });
          },
        },
      });
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={done ? "default" : "outline"}
      aria-pressed={done}
      disabled={pending}
      className={cn("h-7 px-2.5", className)}
      onClick={() =>
        done
          ? save("planned", `“${title}” için “${label}” işaretin kaldırıldı.`)
          : save("completed", `“${title}” için “${label}” işaretlendi.`)
      }
    >
      <Check /> {label}
    </Button>
  );
}
