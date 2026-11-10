import { Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Fold, ShowMore } from "@/components/fold";
import { ItemFilterBar, ItemFilterProvider } from "@/components/item-filter";
import { BackLink, PageSkeleton } from "@/components/page-skeleton";
import { Avatar } from "@/components/ui/avatar";
import { formatDate } from "@/lib/dates";
import { getCurrentUser, requireUser } from "@/modules/auth/session";
import { todayIn } from "@/modules/challenges/domain/cadence";
import { formatRating } from "@/modules/entries/labels";
import { ListCard } from "@/modules/lists/components/list-card";
import { MediaCover } from "@/modules/media/components/media-cover";
import { MediaTitle } from "@/modules/media/components/media-title";
import { formatTitle } from "@/modules/media/titles";
import { ProfileHistory } from "@/modules/people/components/profile-history";
import { ACTIVITY_KINDS, describeTypeCounts, inProgressLabel } from "@/modules/people/domain";
import { getProfileName, getProfilePage } from "@/modules/people/queries";

export async function generateMetadata({ params }: PageProps<"/people/[userId]">): Promise<Metadata> {
  const { userId } = await params;
  const user = await getCurrentUser();
  return { title: (user ? await getProfileName(user.id, userId) : null) ?? "Profil" };
}

export default function ProfilePage({ params }: PageProps<"/people/[userId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Profile params={params} />
    </Suspense>
  );
}

async function Profile({ params }: Pick<PageProps<"/people/[userId]">, "params">) {
  const { userId } = await params;
  const user = await requireUser();
  const data = await getProfilePage(user.id, userId);
  // Someone who shares no group with the viewer looks exactly like nobody.
  if (!data) notFound();
  const { person, isSelf, viaSiteAdmin, sharedGroups, history, historyTruncated, now, stats, publicLists } = data;

  const kinds = ACTIVITY_KINDS.map((kind) => ({ slug: kind.slug, label: kind.label, count: history.filter((item) => item.kind === kind.slug).length })).filter(
    (kind) => kind.count > 0,
  );
  const statLine = [
    stats.finished.length > 0 ? `Bu yıl ${describeTypeCounts(stats.finished)} bitirdi` : null,
    stats.averageRating !== null ? `ortalama puanı ${formatRating(stats.averageRating)} (${stats.ratingCount} puan)` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-8">
      <BackLink href="/people">Kişiler</BackLink>
      <header className="flex items-center gap-4">
        <Avatar name={person.name} seed={person.id} className="size-16 text-lg" />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{person.name}</h1>
          <p className="text-sm text-muted-foreground">
            {[person.username ? `@${person.username}` : null, `${formatDate(todayIn("Europe/Istanbul", person.joinedAt))} tarihinden beri üye`]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {sharedGroups.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              {isSelf ? "Grupların" : sharedGroups.length > 1 ? "Ortak gruplarınız" : "Ortak grubunuz"}:{" "}
              {sharedGroups.map((group, index) => (
                <span key={group.id}>
                  <Link href={`/groups/${group.id}`} className="font-medium text-foreground hover:underline">
                    {group.name}
                  </Link>
                  {index < sharedGroups.length - 1 ? ", " : ""}
                </span>
              ))}
            </p>
          ) : null}
        </div>
      </header>

      {isSelf || viaSiteAdmin ? (
        <p className="flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {isSelf
            ? "Profilin, gruplarındaki kişilere böyle görünür: herkes yalnızca kendi de üye olduğu gruplardakini görür. Gizli listelerin ve kişisel notların görünmez."
            : "Bu profile site yöneticisi olarak bakıyorsun; ortak bir grubunuz yok."}
        </p>
      ) : null}

      {statLine ? <p className="text-sm">{statLine}</p> : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-8">
          {now.length > 0 ? (
            <Fold remember="profile-now" title="Şu an">
              <ShowMore initial={4} as="ul" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {now.map((item) => (
                  <li key={item.entryId} className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-xs">
                    <MediaCover src={item.imageUrl} title={formatTitle(item)} icon={item.icon} className="w-10" />
                    <div className="min-w-0">
                      <Link href={`/entries/${item.entryId}`} className="line-clamp-2 font-medium leading-snug hover:underline">
                        <MediaTitle media={item} />
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {inProgressLabel(item.mediaType)} ·{" "}
                        <Link href={`/challenges/${item.challengeId}`} className="hover:underline">
                          {item.challengeTitle}
                        </Link>
                      </p>
                    </div>
                  </li>
                ))}
              </ShowMore>
            </Fold>
          ) : null}

          <Fold remember="profile-history" title="Geçmiş">
            <ItemFilterProvider>
              <ItemFilterBar items={history.map((item) => item.filterKey)} types={kinds} className="mb-4" />
              <ProfileHistory items={history.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }))} />
            </ItemFilterProvider>
            {historyTruncated ? <p className="mt-4 text-xs text-muted-foreground">Son {history.length} hareket gösteriliyor.</p> : null}
          </Fold>
        </div>

        <aside className="min-w-0">
          <Fold remember="profile-lists" title="Herkese açık listeleri">
            {publicLists.length > 0 ? (
              <ShowMore initial={4} className="flex flex-col gap-4">
                {publicLists.map((list) => (
                  <ListCard key={list.id} list={list} />
                ))}
              </ShowMore>
            ) : (
              <p className="text-sm text-muted-foreground">{isSelf ? "Herkese açık listen yok." : "Herkese açık listesi yok."}</p>
            )}
          </Fold>
        </aside>
      </div>
    </div>
  );
}
