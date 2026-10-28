import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { getCurrentUser } from "@/modules/auth/session";
import { PrintView } from "@/modules/exports/components/print-view";
import { getListExport } from "@/modules/exports/queries";

export const metadata: Metadata = { title: "Yazdır", robots: { index: false, follow: false } };

export default function ListPrintPage({ params, searchParams }: PageProps<"/lists/[listId]/print">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ListPrint params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ListPrint({ params, searchParams }: Pick<PageProps<"/lists/[listId]/print">, "params" | "searchParams">) {
  const [{ listId }, query] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  const doc = await getListExport(user?.id ?? null, listId);
  if (!doc) notFound();
  return <PrintView doc={doc} backHref={`/lists/${listId}`} autoPrint={query.auto !== undefined} />;
}
