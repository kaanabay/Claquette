import { Clapperboard } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Clapperboard className="size-4" aria-hidden />
      </span>
      {/* On the narrowest phones the icon alone leaves room for the menu. */}
      <span className="max-[400px]:sr-only">Claquette</span>
    </Link>
  );
}
