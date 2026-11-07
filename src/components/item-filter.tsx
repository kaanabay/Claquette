"use client";

// Filtering a page's items in place, without a round trip: the page wraps its item sections in
// ItemFilterProvider and shows the chips; every item reads the filter through FilterItem (EntryCard
// does it itself), so sections, groups and counts follow along. Outside a provider nothing is filtered.

import { createContext, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ItemFilter = { type: string | null };

const FilterContext = createContext<{ filter: ItemFilter; setType: (type: string | null) => void } | null>(null);

export function ItemFilterProvider({ children }: { children: ReactNode }) {
  const [type, setType] = useState<string | null>(null);
  return <FilterContext.Provider value={{ filter: { type }, setType }}>{children}</FilterContext.Provider>;
}

/** The page's filter; null outside a filtered page. */
export function useItemFilter(): ItemFilter | null {
  return useContext(FilterContext)?.filter ?? null;
}

export const isFiltering = (filter: ItemFilter | null): filter is ItemFilter => filter !== null && filter.type !== null;

export function matchesFilter(filter: ItemFilter | null, item: { type: string }): boolean {
  return !isFiltering(filter) || filter.type === item.type;
}

export type TypeCount = { slug: string; label: string; icon: string; count: number };

const chip = (selected: boolean) =>
  cn(
    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors hover:bg-muted",
    selected && "border-primary bg-accent font-medium",
  );

/** Chips that filter the items by media type; shown only when the items are of two types or more. */
export function TypeFilterBar({ types, className }: { types: readonly TypeCount[]; className?: string }) {
  const context = useContext(FilterContext);
  if (!context || types.length < 2) return null;
  const { filter, setType } = context;
  const total = types.reduce((sum, type) => sum + type.count, 0);
  return (
    <div role="group" aria-label="Türe göre süz" className={cn("flex flex-wrap items-center gap-2", className)}>
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
          <span aria-hidden>{type.icon}</span>
          {type.label} <span className="text-muted-foreground">{type.count}</span>
        </button>
      ))}
    </div>
  );
}

/** Renders its item only while it matches the filter. */
export function FilterItem({ type, children }: { type: string; children: ReactNode }) {
  return matchesFilter(useItemFilter(), { type }) ? children : null;
}

/** A group of items (a round, a column) shown only while one of them matches; always while nothing is filtered. */
export function FilterGroup({ types, children }: { types: readonly string[]; children: ReactNode }) {
  const filter = useItemFilter();
  if (!isFiltering(filter)) return children;
  return types.some((type) => matchesFilter(filter, { type })) ? children : null;
}

/** How many of these items match the filter (all of them while nothing is filtered). */
export function FilteredCount({ types }: { types: readonly string[] }) {
  const filter = useItemFilter();
  return types.filter((type) => matchesFilter(filter, { type })).length;
}

/** Says so when the filter leaves none of these items (a section's own empty state covers no items at all). */
export function FilterEmpty({ types, className }: { types: readonly string[]; className?: string }) {
  const filter = useItemFilter();
  if (!isFiltering(filter) || types.length === 0 || types.some((type) => matchesFilter(filter, { type }))) return null;
  return <p className={cn("text-xs text-muted-foreground", className)}>Bu türde öge yok.</p>;
}
