"use client";

import { Activity, CircleCheck, MessageSquare, Plus, Star } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { isFiltering, matchesFilter, useItemFilter } from "@/components/item-filter";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { formatShortDate } from "@/lib/short-date";
import type { ActivityKind } from "../domain";
import type { HistoryItem } from "../queries";

const MONTH = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "Europe/Istanbul" });

const ICONS: Record<ActivityKind, typeof Activity> = { added: Plus, finished: CircleCheck, rated: Star, note: MessageSquare, other: Activity };

/** A history row as the page hands it over (the time as an ISO string). */
export type HistoryRow = Omit<HistoryItem, "createdAt"> & { createdAt: string };

const FIRST = 5;
const STEP = 20;

/**
 * Everything someone did, newest first, month by month: the latest five, more on request. While the
 * page is searched or filtered by kind, every match shows.
 */
export function ProfileHistory({ items }: { items: HistoryRow[] }) {
  const filter = useItemFilter();
  const [limit, setLimit] = useState(FIRST);
  if (items.length === 0) {
    return (
      <EmptyState icon={<Activity />} title="Henüz hareket yok">
        Ortak gruplarınızda bir şey eklediğinde, bitirdiğinde ya da not yazdığında burada görünür.
      </EmptyState>
    );
  }

  const filtering = isFiltering(filter);
  const matching = items.filter((item) => matchesFilter(filter, item.filterKey));
  const shown = filtering ? matching : matching.slice(0, limit);
  const rest = matching.length - shown.length;
  const months: { label: string; items: HistoryRow[] }[] = [];
  for (const item of shown) {
    const label = MONTH.format(new Date(item.createdAt));
    const last = months.at(-1);
    if (last?.label === label) last.items.push(item);
    else months.push({ label, items: [item] });
  }

  return (
    <div className="flex flex-col gap-6">
      {months.map((month) => (
        <section key={month.label}>
          <h3 className="mb-3 text-sm font-semibold">{month.label}</h3>
          <ol className="flex flex-col gap-3">
            {month.items.map((item) => {
              const Icon = ICONS[item.kind];
              return (
                <li key={item.id} className="flex gap-3 text-sm">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden>
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0 leading-snug">
                    <p>{item.sentence.charAt(0).toLocaleUpperCase("tr-TR") + item.sentence.slice(1)}</p>
                    <p className="mt-0.5 flex flex-wrap gap-x-1 text-xs text-muted-foreground">
                      <time dateTime={item.createdAt}>{formatShortDate(new Date(item.createdAt))}</time>
                      {item.challengeTitle && item.challengeId ? (
                        <>
                          <span>·</span>
                          <Link href={`/challenges/${item.challengeId}`} className="hover:underline">
                            {item.challengeTitle}
                          </Link>
                        </>
                      ) : null}
                      {item.entryId ? (
                        <>
                          <span>·</span>
                          <Link href={`/entries/${item.entryId}`} className="hover:underline">
                            ögeye git
                          </Link>
                        </>
                      ) : null}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      {matching.length === 0 ? <p className="text-xs text-muted-foreground">Aramaya uyan hareket yok.</p> : null}
      {rest > 0 ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => setLimit(limit + STEP)} className="self-start">
          Daha fazla göster <span className="font-normal text-muted-foreground">({rest})</span>
        </Button>
      ) : !filtering && limit > FIRST ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => setLimit(FIRST)} className="self-start text-muted-foreground">
          Daha az göster
        </Button>
      ) : null}
    </div>
  );
}
