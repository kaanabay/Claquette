import { Bookmark, Users } from "lucide-react";
import Link from "next/link";

const LINK =
  "flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:px-2.5";

/**
 * Top-level sections next to the logo (which leads home). Static, so the shell stays prerendered.
 * On phones only the icons show, so the header fits beside the user menu.
 */
export function MainNav() {
  return (
    <nav aria-label="Ana menü" className="flex items-center gap-1 text-sm">
      <Link href="/lists" className={LINK} title="Listelerim">
        <Bookmark className="size-4" aria-hidden /> <span className="sr-only sm:not-sr-only">Listelerim</span>
      </Link>
      <Link href="/people" className={LINK} title="Kişiler">
        <Users className="size-4" aria-hidden /> <span className="sr-only sm:not-sr-only">Kişiler</span>
      </Link>
    </nav>
  );
}
