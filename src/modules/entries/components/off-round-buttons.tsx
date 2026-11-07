"use client";

import { CalendarOff, Undo2 } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { returnFromOffRoundAction, takeOffRoundAction } from "../actions";

const BACK = {
  pool: { label: "Havuza geri al", done: "havuza geri alındı" },
  suggestions: { label: "Önerilere geri al", done: "önerilere geri alındı" },
} as const;

/** "Tur dışına al": the notice's "Geri al" puts the item back where it was (its round, the pool, the suggestions). */
export function TakeOffRoundButton({
  entryId,
  title,
  variant = "outline",
  className,
}: {
  entryId: string;
  title: string;
  variant?: "outline" | "ghost";
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      disabled={pending}
      className={className}
      title="Turlara girmez, listede kalır; herkes kendi zamanında bitirir."
      onClick={() =>
        startTransition(async () => {
          const result = await takeOffRoundAction(entryId);
          if ("error" in result) {
            toast(result.error, { isError: true });
            return;
          }
          toast(`“${title}” tur dışına alındı.`, {
            action: {
              label: "Geri al",
              onClick: async () => {
                const undone = await returnFromOffRoundAction(entryId, result.previous);
                if ("error" in undone) toast(undone.error, { isError: true });
              },
            },
          });
        })
      }
    >
      <CalendarOff /> Tur dışına al
    </Button>
  );
}

/** Back from "Tur dışı" to the pool or the suggestions, while the item is still open. */
export function ReturnFromOffRoundButton({ entryId, title, to }: { entryId: string; title: string; to: "pool" | "suggestions" }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={pending}
      className="text-muted-foreground"
      onClick={() =>
        startTransition(async () => {
          const result = await returnFromOffRoundAction(entryId);
          if ("error" in result) {
            toast(result.error, { isError: true });
            return;
          }
          toast(`“${title}” ${BACK[to].done}.`, {
            action: {
              label: "Geri al",
              onClick: async () => {
                const undone = await takeOffRoundAction(entryId);
                if ("error" in undone) toast(undone.error, { isError: true });
              },
            },
          });
        })
      }
    >
      <Undo2 /> {BACK[to].label}
    </Button>
  );
}
