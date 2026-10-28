import { ListOrdered, Settings } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink, PageSkeleton } from "@/components/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, SectionTitle } from "@/components/ui/misc";
import { getCurrentUser } from "@/modules/auth/session";
import { setListSortAction } from "@/modules/lists/actions";
import { AddListItemForm } from "@/modules/lists/components/add-list-item-form";
import { VisibilityBadge } from "@/modules/lists/components/list-card";
import { DeleteListButton, ListSettingsForm } from "@/modules/lists/components/list-forms";
import { ListItemsEditor } from "@/modules/lists/components/list-items-editor";
import { ListView } from "@/modules/lists/components/list-view";
import { SharePanel } from "@/modules/lists/components/share-panel";
import { ExportMenu } from "@/modules/exports/components/export-menu";
import { getListPage, getListTitle, getPublicListPreview } from "@/modules/lists/queries";
import { SortSelect } from "@/modules/media/components/sort-select";
import { listMediaTypes } from "@/modules/media/service";
import { isSortKey, SORTS } from "@/modules/media/sort";

// Personal lists aren't meant for search engines, even public ones (they carry the owner's name).
const robots = { index: false, follow: false };

export async function generateMetadata({ params }: PageProps<"/lists/[listId]">): Promise<Metadata> {
  const { listId } = await params;
  const preview = await getPublicListPreview(listId);
  if (preview) {
    const description = `Hazırlayan: ${preview.ownerName} · ${preview.countsLabel}`;
    return { title: preview.title, description, openGraph: { title: preview.title, description, type: "website" }, robots };
  }
  const user = await getCurrentUser();
  return { title: (await getListTitle(user?.id ?? null, listId)) ?? "Liste", robots };
}

export default function ListPage({ params, searchParams }: PageProps<"/lists/[listId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ListContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ListContent({ params, searchParams }: Pick<PageProps<"/lists/[listId]">, "params" | "searchParams">) {
  const [{ listId }, query] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  // ?sort= is a viewer's own pick; without it the list shows in the order its owner saved.
  const data = await getListPage(user?.id ?? null, listId, { sort: isSortKey(query.sort) ? query.sort : undefined });
  if (!data) notFound();
  const { list, items, isOwner, sort } = data;

  if (!isOwner) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{list.title}</h1>
            <ExportMenu base={`/lists/${list.id}`} />
          </div>
          <p className="text-sm text-muted-foreground">
            Hazırlayan: <span className="font-medium text-foreground">{list.ownerName}</span> · {data.countsLabel}
            {list.isRanked ? " · sıralı" : ""}
          </p>
          {list.description ? <p className="max-w-2xl whitespace-pre-line text-muted-foreground">{list.description}</p> : null}
        </header>
        {items.length > 1 ? (
          <div className="flex justify-end">
            <SortSelect value={sort} options={SORTS} />
          </div>
        ) : null}
        <ListView items={items} isRanked={list.isRanked} manual={sort === "manual"} />
        {!user ? (
          <Card>
            <CardContent className="flex flex-col items-start gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">Claquette’te arkadaşlarınla ortak kitap ve film listeleri tutabilir, kendi listeni paylaşabilirsin.</p>
              <Link href="/sign-up" className={buttonVariants({ size: "sm" })}>
                Hesap aç
              </Link>
            </CardContent>
          </Card>
        ) : null}
      </div>
    );
  }

  const mediaTypes = await listMediaTypes();
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <BackLink href="/lists">Listelerim</BackLink>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{list.title}</h1>
        {list.description ? <p className="max-w-2xl whitespace-pre-line text-muted-foreground">{list.description}</p> : null}
        <div className="flex flex-wrap items-center gap-1.5">
          <VisibilityBadge visibility={list.visibility} />
          {list.isRanked ? (
            <Badge>
              <ListOrdered /> Sıralı
            </Badge>
          ) : null}
          <Badge>{data.countsLabel}</Badge>
          <span className="ml-auto">
            <ExportMenu base={`/lists/${list.id}`} />
          </span>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <aside className="flex min-w-0 flex-col gap-4 lg:order-2">
          <Card>
            <CardHeader>
              <CardTitle>Paylaş</CardTitle>
            </CardHeader>
            <CardContent>
              <SharePanel listId={list.id} title={list.title} visibility={list.visibility} />
            </CardContent>
          </Card>
          <details className="group rounded-xl border bg-card shadow-xs">
            <summary className="flex cursor-pointer list-none items-center gap-2 p-5 font-semibold">
              <Settings className="size-4 text-muted-foreground" /> Liste ayarları
            </summary>
            <div className="flex flex-col gap-6 px-5 pb-5">
              <ListSettingsForm
                listId={list.id}
                values={{ title: list.title, description: list.description, visibility: list.visibility, isRanked: list.isRanked }}
              />
              <DeleteListButton listId={list.id} title={list.title} />
            </div>
          </details>
        </aside>

        <div className="flex min-w-0 flex-col gap-6 lg:order-1">
          <Card>
            <CardHeader>
              <CardTitle>Öge ekle</CardTitle>
            </CardHeader>
            <CardContent>
              <AddListItemForm listId={list.id} mediaTypes={mediaTypes} existing={data.existing} />
            </CardContent>
          </Card>
          <section>
            <SectionTitle action={items.length > 1 ? <SortSelect value={sort} options={SORTS} save={setListSortAction.bind(null, list.id)} /> : null}>
              Ögeler <span className="font-normal text-muted-foreground">({items.length})</span>
            </SectionTitle>
            {items.length > 0 ? (
              <>
                <p className="mb-3 text-xs text-muted-foreground">
                  {sort === "manual"
                    ? "Sırayı değiştirmek için soldaki tutamacı sürükle. Tarihe göre sıralamak için yukarıdan seç; seçimin listeyi açan herkes için geçerli olur."
                    : "Liste seçtiğin sıralamayla gösteriliyor; listeyi açan herkes böyle görür. Sürükleyerek sıralamak için “Elle”yi seç."}
                </p>
                <ListItemsEditor listId={list.id} isRanked={list.isRanked} sort={sort} items={items} shareTargets={data.shareTargets} />
              </>
            ) : (
              <EmptyState title="Liste boş">Yukarıdan ilk ögeyi ekle.</EmptyState>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
