"use client";

// Sections that fold in and out, and long lists that show their first few. What is happening now
// starts open; what is over or still ahead starts folded. Either way the viewer's last choice for a
// kind of section is remembered in the browser (`remember`), and a search on the page reaches into
// folded sections and long lists alike.

import { ChevronRight } from "lucide-react";
import { Children, useId, useState, useSyncExternalStore, type ReactNode } from "react";
import type { FilterKey } from "@/lib/search-text";
import { cn } from "@/lib/utils";
import { isFiltering, matchesFilter, useItemFilter } from "./item-filter";
import { Button } from "./ui/button";

const STORAGE_PREFIX = "claquette:fold:";
const CHANGED = "claquette:fold";

function readStored(key: string): boolean | null {
  try {
    const value = window.localStorage.getItem(STORAGE_PREFIX + key);
    return value === null ? null : value === "1";
  } catch {
    return null;
  }
}

function writeStored(key: string, open: boolean) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, open ? "1" : "0");
    window.dispatchEvent(new Event(CHANGED));
  } catch {
    // Storage blocked (private window): the choice lasts for this page only.
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

/**
 * A section whose heading folds it in and out; `action` (a button) sits beside the heading.
 * With `items`, it hides while the page's search or filter leaves none of them, and opens while a
 * search finds one inside (closing it then holds until the search changes).
 */
export function Fold({
  title,
  action,
  items,
  defaultOpen = true,
  forceOpen = false,
  remember,
  level = 2,
  id,
  label,
  className,
  children,
}: {
  title: ReactNode;
  action?: ReactNode;
  items?: readonly FilterKey[];
  defaultOpen?: boolean;
  /** Held open meanwhile (e.g. while a note is being written in it). */
  forceOpen?: boolean;
  /** One key per kind of section ("board-done"): the viewer's last choice is kept in the browser. */
  remember?: string;
  /** 2: a page section, 3: a group inside one. */
  level?: 2 | 3;
  id?: string;
  /** Names the section as a region (for sections people jump to). */
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  const filter = useItemFilter();
  const contentId = useId();
  const stored = useSyncExternalStore(
    subscribe,
    () => (remember ? readStored(remember) : null),
    () => null,
  );
  const [choice, setChoice] = useState<boolean | null>(null);
  const [closedForSearch, setClosedForSearch] = useState<string | null>(null);

  const matched = !items || items.some((key) => matchesFilter(filter, key));
  const words = filter?.words.join(" ") ?? "";
  const searchOpens = items !== undefined && words !== "" && matched && closedForSearch !== words;
  const open = forceOpen || searchOpens || (choice ?? stored ?? defaultOpen);

  function toggle() {
    if (searchOpens) {
      setClosedForSearch(words);
      return;
    }
    setChoice(!open);
    if (remember) writeStored(remember, !open);
  }

  const Heading = level === 2 ? "h2" : "h3";
  return (
    <section
      id={id}
      aria-label={label}
      hidden={isFiltering(filter) && items !== undefined && !matched}
      className={cn("scroll-mt-24", className)}
    >
      {/* On a narrow screen the action moves under the heading rather than squeezing it onto two lines. */}
      <div className={cn("flex flex-wrap items-center justify-between gap-x-3 gap-y-2", level === 2 ? "mb-3" : "mb-2")}>
        <Heading className={level === 2 ? "shrink-0 text-lg font-semibold tracking-tight" : "shrink-0 text-sm font-semibold"}>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={contentId}
            className="flex items-center gap-1.5 rounded-md text-left hover:opacity-80"
          >
            <ChevronRight
              className={cn("shrink-0 text-muted-foreground transition-transform", level === 2 ? "size-5" : "size-4", open && "rotate-90")}
              aria-hidden
            />
            <span className="flex flex-wrap items-center gap-x-2">{title}</span>
          </button>
        </Heading>
        {action}
      </div>
      <div id={contentId} hidden={!open}>
        {children}
      </div>
    </section>
  );
}

/**
 * A list that shows its first `initial` items, more on request ("Daha fazla göster"). While the page
 * is searched or filtered every match shows. Children are the items in order; `items` their filter keys.
 */
export function ShowMore({
  initial,
  step,
  items,
  as: Tag = "div",
  className,
  children,
}: {
  initial: number;
  /** How many more each press shows (default: twice the first). */
  step?: number;
  items?: readonly FilterKey[];
  as?: "div" | "ol" | "ul";
  className?: string;
  children: ReactNode;
}) {
  const filter = useItemFilter();
  const [limit, setLimit] = useState(initial);
  const all = Children.toArray(children);
  const matching = all.filter((_, index) => !items?.[index] || matchesFilter(filter, items[index]));
  const filtering = isFiltering(filter);
  const shown = filtering ? matching : matching.slice(0, limit);
  const rest = matching.length - shown.length;

  return (
    <>
      <Tag className={className}>{shown}</Tag>
      {rest > 0 ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => setLimit(limit + (step ?? initial * 2))} className="mt-2">
          Daha fazla göster <span className="font-normal text-muted-foreground">({rest})</span>
        </Button>
      ) : !filtering && limit > initial && matching.length > initial ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => setLimit(initial)} className="mt-2 text-muted-foreground">
          Daha az göster
        </Button>
      ) : null}
    </>
  );
}
