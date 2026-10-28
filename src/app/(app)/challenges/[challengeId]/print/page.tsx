import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { requireUser } from "@/modules/auth/session";
import { PrintView } from "@/modules/exports/components/print-view";
import { getChallengeExport } from "@/modules/exports/queries";

export const metadata: Metadata = { title: "Yazdır" };

export default function ChallengePrintPage({ params, searchParams }: PageProps<"/challenges/[challengeId]/print">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ChallengePrint params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ChallengePrint({ params, searchParams }: Pick<PageProps<"/challenges/[challengeId]/print">, "params" | "searchParams">) {
  const [{ challengeId }, query] = await Promise.all([params, searchParams]);
  const user = await requireUser();
  const doc = await getChallengeExport(user.id, challengeId);
  if (!doc) notFound();
  return <PrintView doc={doc} backHref={`/challenges/${challengeId}`} autoPrint={query.auto !== undefined} />;
}
