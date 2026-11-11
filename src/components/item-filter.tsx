"use client";

// Searching and filtering a page's items in place, without a round trip: the page wraps its item
// sections in ItemFilterProvider and shows ItemFilterBar; every item reads the filter through
// FilterItem (EntryCard does it itself) with its FilterKey, so sections, folds (components/fold.tsx)
// and counts follow along. Outside a provider nothing is filtered.

import { Search, X } from "lucide-react";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { matchesWords, searchWords, type FilterKey } from "@/lib/search-text";
import { cn } from "@/lib/utils";
import { Input } from "./ui/fields";

export type ItemFilter = { type: string | null; words: readonly string[] };

type FilterState = { filter: ItemFilter; query: string; setType: (type: string | null) => void; setQuery: (query: string) => void };

const FilterContext = createContext<FilterState | null>(null);

export function ItemFilterProvider({ children }: { children: ReactNode }) {
  const [type, setType] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const state = useMemo(() => ({ filter: { type, words: searchWords(query) }, query, setType, setQuery }), [type, query]);
  return <FilterContext.Provider value={state}>{children}</FilterContext.Provider>;
}

/** The page's filter; null outside a filtered page. */
export function useItemFilter(): ItemFilter | null {
  return useContext(FilterContext)?.filter ?? null;
}

export const isFiltering = (filter: ItemFilter | null): filter is ItemFilter =>
  filter !== null && (filter.type !== null || filter.words.length > 0);

const isSearching = (filter: ItemFilter | null) => filter !== null && filter.words.length > 0;

/**
 * Whether an item passes: of the chosen type (items without a type always are; a card with `types`
 * when it holds that type), holding every word searched.
 */
export function matchesFilter(filter: ItemFilter | null, key: FilterKey): boolean {
  if (!isFiltering(filter)) return true;
  if (filter.type !== null) {
    if (key.types !== undefined ? !key.types.includes(filter.type) : key.type !== undefined && key.type !== filter.type) return false;
  }
  return filter.words.length === 0 || (key.text !== undefined && matchesWords(key.text, filter.words));
}

export type TypeCount = { slug: string; label: string; icon?: string; count: number };

const chip = (selected: boolean) =>
  cn(
    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors hover:bg-muted",
    selected && "border-primary bg-accent font-medium",
  );

/**
 * The search box ("Bu sayfada ara") and, when the items are of two types or more, chips that filter
 * them by type. `items` are the page's items (each once), to say how many match. Hidden for fewer
 * than two items: there is nothing to look for. "Tümü" counts the items; where one item holds several
 * types (list cards) the type counts overlap.
 */
export function ItemFilterBar({
  items,
  types = [],
  className,
}: {
  items: readonly FilterKey[];
  types?: readonly TypeCount[];
  className?: string;
}) {
  const state = useContext(FilterContext);
  if (!state || items.length < 2) return null;
  const { filter, query, setType, setQuery } = state;
  const matches = isFiltering(filter) ? items.filter((key) => matchesFilter(filter, key)).length : null;
  const total = items.length;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div role="search" className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setQuery("");
            }}
            placeholder="Bu sayfada ara"
            aria-label="Bu sayfada ara"
            className="pr-9 pl-9 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Aramayı temizle"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        {types.length >= 2 ? (
          <div role="group" aria-label="Türe göre süz" className="flex flex-wrap items-center gap-2">
            <button type="button" aria-pressed={filter.type === null} className={chip(filter.type === null)} onClick={() => setType(null)}>
              Tümü <span className="text-muted-foreground">{total}</span>
            </button>
            {types.map((type) => (
              <button
                key={type.slug}
                type="button"
                aria-pressed={filter.type === type.slug}
                className={chip(filter.type === type.slug)}
                onClick={() => setType(filter.type === type.slug ? null : type.slug)}
              >
                {type.icon ? <span aria-hidden>{type.icon}</span> : null}
                {type.label} <span className="text-muted-foreground">{type.count}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {matches !== null ? (
        <p role="status" className="text-xs text-muted-foreground">
          {matches === 0 ? "Eşleşen yok." : `${matches} sonuç`}
        </p>
      ) : null}
    </div>
  );
}

/** Renders its item only while it matches the filter. */
export function FilterItem({ filterKey, children }: { filterKey: FilterKey; children: ReactNode }) {
  return matchesFilter(useItemFilter(), filterKey) ? children : null;
}

/** A group of items (a round, a section) shown only while one of them matches; always while nothing is filtered. */
export function FilterGroup({ items, children }: { items: readonly FilterKey[]; children: ReactNode }) {
  const filter = useItemFilter();
  if (!isFiltering(filter)) return children;
  return items.some((key) => matchesFilter(filter, key)) ? children : null;
}

/** How many of these items match the filter (all of them while nothing is filtered). */
export function FilteredCount({ items }: { items: readonly FilterKey[] }) {
  const filter = useItemFilter();
  return items.filter((key) => matchesFilter(filter, key)).length;
}

/** Says so when the filter leaves none of these items (a section's own empty state covers no items at all). */
export function FilterEmpty({ items, message, className }: { items: readonly FilterKey[]; message?: string; className?: string }) {
  const filter = useItemFilter();
  if (!isFiltering(filter) || items.length === 0 || items.some((key) => matchesFilter(filter, key))) return null;
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      {message ?? (isSearching(filter) ? "Aramaya uyan öge yok." : "Bu türde öge yok.")}
    </p>
  );
}
