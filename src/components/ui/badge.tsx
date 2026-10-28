import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { toneClass } from "@/lib/tones";

export function Badge({ className, tone, ...props }: ComponentProps<"span"> & { tone?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset [&_svg]:size-3",
        tone ? toneClass(tone) : "bg-muted text-muted-foreground ring-border",
        className,
      )}
      {...props}
    />
  );
}
