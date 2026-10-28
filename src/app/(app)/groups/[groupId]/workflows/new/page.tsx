import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink, PageSkeleton } from "@/components/page-skeleton";
import { requireUser } from "@/modules/auth/session";
import { getGroupSummary } from "@/modules/groups/queries";
import { WorkflowEditor } from "@/modules/workflows/components/workflow-editor";

export const metadata: Metadata = { title: "Yeni durum akışı" };

export default function NewWorkflowPage({ params }: PageProps<"/groups/[groupId]/workflows/new">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewWorkflow params={params} />
    </Suspense>
  );
}

async function NewWorkflow({ params }: Pick<PageProps<"/groups/[groupId]/workflows/new">, "params">) {
  const { groupId } = await params;
  const user = await requireUser();
  const group = await getGroupSummary(user.id, groupId);
  if (!group) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href={`/groups/${groupId}`}>{group.name}</BackLink>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Yeni durum akışı</h1>
        <p className="mt-1 text-muted-foreground">
          Ögelerin geçeceği adımları kendiniz belirleyin; yeni bir ortak liste oluştururken bu akışı seçebilirsiniz.
        </p>
      </div>
      <WorkflowEditor groupId={groupId} />
    </div>
  );
}
