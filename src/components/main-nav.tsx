import { Bookmark } from "lucide-react";
import Link from "next/link";

/** Top-level sections next to the logo (which leads home). Static, so the shell stays prerendered. */
export function MainNav() {
  return (
    <nav aria-label="Ana menü" className="flex items-center gap-1 text-sm">
      <Link
        href="/lists"
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Bookmark className="size-4" aria-hidden /> Listelerim
      </Link>
    </nav>
  );
}
