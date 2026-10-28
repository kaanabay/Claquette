import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink, PageSkeleton } from "@/components/page-skeleton";
import { requireUser } from "@/modules/auth/session";
import { ChallengeForm } from "@/modules/challenges/components/challenge-form";
import { getNewChallengeData } from "@/modules/challenges/queries";

export const metadata: Metadata = { title: "Yeni ortak liste" };

export default function NewChallengePage({ params }: PageProps<"/groups/[groupId]/challenges/new">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewChallenge params={params} />
    </Suspense>
  );
}

async function NewChallenge({ params }: Pick<PageProps<"/groups/[groupId]/challenges/new">, "params">) {
  const { groupId } = await params;
  const user = await requireUser();
  const data = await getNewChallengeData(user.id, groupId);
  if (!data) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href={`/groups/${groupId}`}>{data.group.name}</BackLink>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Yeni ortak liste</h1>
        <p className="mt-1 text-muted-foreground">
          Turların sıklığını, seçim kuralını ve katılımcıları belirle. Yıllık kitap listesi, aylık yönetmen seçkisi ya da haftalık film takası buradan kurulur.
        </p>
      </div>
      <ChallengeForm
        groupId={groupId}
        today={data.today}
        members={data.members}
        mediaTypes={data.mediaTypes}
        workflows={data.workflows}
      />
    </div>
  );
}
