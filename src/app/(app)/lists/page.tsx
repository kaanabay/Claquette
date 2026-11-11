import { Bookmark } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Fold, ShowMore } from "@/components/fold";
import { FilterEmpty, FilteredCount, ItemFilterBar, ItemFilterProvider, type TypeCount } from "@/components/item-filter";
import { PageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, SectionTitle } from "@/components/ui/misc";
import { requireUser } from "@/modules/auth/session";
import { ListCard } from "@/modules/lists/components/list-card";
import { CreateListForm } from "@/modules/lists/components/list-forms";
import { listMyLists, type ListSummary } from "@/modules/lists/queries";

export const metadata: Metadata = { title: "Listelerim" };

export default function MyListsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MyLists />
    </Suspense>
  );
}

async function MyLists() {
  const user = await requireUser();
  const lists = await listMyLists(user.id);
  const current = lists.filter((list) => list.archivedAt === null);
  const archived = lists.filter((list) => list.archivedAt !== null);
  const keys = (rows: ListSummary[]) => rows.map((list) => list.filterKey);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Listelerim</h1>
        <p className="mt-1 text-muted-foreground">
          Kendi koleksiyonların: izlenecekler, yıl sonu Top 10’ların… Tur ve tarih yok; istersen herkese açıp linkini paylaşırsın.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <ItemFilterProvider>
          <div className="flex min-w-0 flex-col gap-8">
            <section className="min-w-0">
              <SectionTitle>
                Listeler{" "}
                <span className="font-normal text-muted-foreground">
                  (<FilteredCount items={keys(current)} />)
                </span>
              </SectionTitle>
              <ItemFilterBar items={keys(lists)} types={countTypes(lists)} className="mb-3" />
              {current.length > 0 ? (
                <>
                  <ShowMore initial={12} items={keys(current)} className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {current.map((list) => (
                      <ListCard key={list.id} list={list} />
                    ))}
                  </ShowMore>
                  <FilterEmpty items={keys(current)} message="Buna uyan liste yok." />
                </>
              ) : (
                <EmptyState icon={<Bookmark />} title={archived.length > 0 ? "Bütün listelerin arşivde" : "Henüz listen yok"}>
                  {archived.length > 0 ? "Aşağıdaki Arşiv’den birini geri alabilir ya da yeni bir liste oluşturabilirsin." : "İzlemek istediklerin ya da en sevdiklerin için ilk listeni oluştur."}
                </EmptyState>
              )}
            </section>
            {archived.length > 0 ? (
              <Fold
                remember="lists-archive"
                defaultOpen={false}
                items={keys(archived)}
                title={
                  <>
                    Arşiv{" "}
                    <span className="font-normal text-muted-foreground">
                      (<FilteredCount items={keys(archived)} />)
                    </span>
                  </>
                }
              >
                <p className="mb-3 text-xs text-muted-foreground">
                  Göz önünde durmasını istemediğin listeler. Hiçbir şeyleri değişmez: herkese açık olanın linki çalışır, ögeleri yerinde kalır.
                </p>
                <ShowMore initial={6} items={keys(archived)} className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {archived.map((list) => (
                    <ListCard key={list.id} list={list} />
                  ))}
                </ShowMore>
              </Fold>
            ) : null}
          </div>
        </ItemFilterProvider>
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Yeni liste</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateListForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** The media types the lists hold: how many lists hold each, most common first. */
function countTypes(lists: readonly ListSummary[]): TypeCount[] {
  const counts = new Map<string, TypeCount>();
  for (const list of lists) {
    for (const type of list.types) {
      const known = counts.get(type.slug);
      if (known) known.count += 1;
      else counts.set(type.slug, { slug: type.slug, label: type.label, icon: type.icon, count: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}
