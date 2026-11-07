import { Activity, CircleCheck, MessageSquare, Plus, Star } from "lucide-react";
import Link from "next/link";
import { FilterEmpty, FilteredCount, FilterGroup, FilterItem } from "@/components/item-filter";
import { EmptyState } from "@/components/ui/misc";
import { formatShortDate } from "@/lib/short-date";
import type { ActivityKind } from "../domain";
import type { HistoryItem } from "../queries";

const MONTH = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "Europe/Istanbul" });

const ICONS: Record<ActivityKind, typeof Activity> = { added: Plus, finished: CircleCheck, rated: Star, note: MessageSquare, other: Activity };

/** Everything someone did, month by month, newest first; each row follows the page's search and kind filter. */
export function ProfileHistory({ items }: { items: HistoryItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState icon={<Activity />} title="Henüz hareket yok">
        Ortak gruplarınızda bir şey eklediğinde, bitirdiğinde ya da not yazdığında burada görünür.
      </EmptyState>
    );
  }
  const months: { label: string; items: HistoryItem[] }[] = [];
  for (const item of items) {
    const label = MONTH.format(item.createdAt);
    const last = months.at(-1);
    if (last?.label === label) last.items.push(item);
    else months.push({ label, items: [item] });
  }

  return (
    <div className="flex flex-col gap-6">
      {months.map((month) => {
        const keys = month.items.map((item) => item.filterKey);
        return (
          <FilterGroup key={month.label} items={keys}>
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                {month.label}
                <span className="font-normal text-muted-foreground">
                  <FilteredCount items={keys} />
                </span>
              </h3>
              <ol className="flex flex-col gap-3">
                {month.items.map((item) => {
                  const Icon = ICONS[item.kind];
                  return (
                    <FilterItem key={item.id} filterKey={item.filterKey}>
                      <li className="flex gap-3 text-sm">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden>
                          <Icon className="size-3.5" />
                        </span>
                        <div className="min-w-0 leading-snug">
                          <p>{item.sentence.charAt(0).toLocaleUpperCase("tr-TR") + item.sentence.slice(1)}</p>
                          <p className="mt-0.5 flex flex-wrap gap-x-1 text-xs text-muted-foreground">
                            <time dateTime={item.createdAt.toISOString()}>{formatShortDate(item.createdAt)}</time>
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
                    </FilterItem>
                  );
                })}
              </ol>
            </section>
          </FilterGroup>
        );
      })}
      <FilterEmpty items={items.map((item) => item.filterKey)} message="Aramaya uyan hareket yok." />
    </div>
  );
}
