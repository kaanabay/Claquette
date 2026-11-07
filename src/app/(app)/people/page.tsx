import { UserRound, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FilterEmpty, FilterItem, ItemFilterBar, ItemFilterProvider } from "@/components/item-filter";
import { PageSkeleton } from "@/components/page-skeleton";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/misc";
import { timeAgo } from "@/lib/dates";
import { requireUser } from "@/modules/auth/session";
import { profileHref } from "@/modules/people/components/person-link";
import { getPeoplePage } from "@/modules/people/queries";

export const metadata: Metadata = { title: "Kişiler" };

export default function PeoplePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <People />
    </Suspense>
  );
}

async function People() {
  const user = await requireUser();
  const people = await getPeoplePage(user.id);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Kişiler</h1>
        <p className="mt-1 text-muted-foreground">
          Gruplarında birlikte olduğun kişiler. Birinin profilinde ortak gruplarınızda yaptıklarını, şu an neyle meşgul olduğunu ve herkese
          açık listelerini görürsün.
        </p>
      </div>
      <Link
        href={profileHref(user.id)}
        className="flex items-center gap-3 rounded-xl border border-dashed p-3 text-sm transition-colors hover:border-primary/60"
      >
        <UserRound className="size-5 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Profilim</span>
          <span className="block text-xs text-muted-foreground">Gruplarındaki kişiler seni böyle görüyor.</span>
        </span>
      </Link>
      {people.length === 0 ? (
        <EmptyState icon={<Users />} title="Henüz kimse yok">
          Bir gruba katıldığında ya da birini grubuna davet ettiğinde burada görünür.
        </EmptyState>
      ) : (
        <ItemFilterProvider>
          <ItemFilterBar items={people.map((person) => person.filterKey)} />
          <ul className="flex flex-col gap-3">
            {people.map((person) => (
              <FilterItem key={person.id} filterKey={person.filterKey}>
                <li>
                  <Link
                    href={profileHref(person.id)}
                    className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-xs transition-colors hover:border-primary/60"
                  >
                    <Avatar name={person.name} seed={person.id} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{person.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[person.username ? `@${person.username}` : null, person.groups.join(", ")].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-muted-foreground">
                      {person.sharedLists > 0 ? <span className="block">{person.sharedLists} ortak liste</span> : null}
                      {person.lastActiveAt ? <span className="block">{timeAgo(person.lastActiveAt)}</span> : null}
                    </span>
                  </Link>
                </li>
              </FilterItem>
            ))}
          </ul>
          <FilterEmpty items={people.map((person) => person.filterKey)} message="Aramaya uyan kişi yok." />
        </ItemFilterProvider>
      )}
    </div>
  );
}
