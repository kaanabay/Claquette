import { Bookmark } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, SectionTitle } from "@/components/ui/misc";
import { requireUser } from "@/modules/auth/session";
import { ListCard } from "@/modules/lists/components/list-card";
import { CreateListForm } from "@/modules/lists/components/list-forms";
import { listMyLists } from "@/modules/lists/queries";

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

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Listelerim</h1>
        <p className="mt-1 text-muted-foreground">
          Kendi koleksiyonların: izlenecekler, yıl sonu Top 10’ların… Tur ve tarih yok; istersen herkese açıp linkini paylaşırsın.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section className="min-w-0">
          <SectionTitle>
            Listeler <span className="font-normal text-muted-foreground">({lists.length})</span>
          </SectionTitle>
          {lists.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {lists.map((list) => (
                <ListCard key={list.id} list={list} />
              ))}
            </div>
          ) : (
            <EmptyState icon={<Bookmark />} title="Henüz listen yok">
              İzlemek istediklerin ya da en sevdiklerin için ilk listeni oluştur.
            </EmptyState>
          )}
        </section>
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
