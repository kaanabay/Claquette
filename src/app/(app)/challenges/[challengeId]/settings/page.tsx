import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink, PageSkeleton } from "@/components/page-skeleton";
import { requireUser } from "@/modules/auth/session";
import { ChallengeForm } from "@/modules/challenges/components/challenge-form";
import { getChallengeSettingsData } from "@/modules/challenges/queries";
import { SiteAdminNotice } from "@/modules/groups/components/site-admin-notice";

export const metadata: Metadata = { title: "Liste ayarları" };

export default function ChallengeSettingsPage({ params }: PageProps<"/challenges/[challengeId]/settings">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ChallengeSettings params={params} />
    </Suspense>
  );
}

async function ChallengeSettings({ params }: Pick<PageProps<"/challenges/[challengeId]/settings">, "params">) {
  const { challengeId } = await params;
  const user = await requireUser();
  const data = await getChallengeSettingsData(user.id, challengeId);
  if (!data) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href={`/challenges/${data.challenge.id}`}>{data.challenge.title}</BackLink>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Liste ayarları</h1>
        <p className="mt-1 text-muted-foreground">
          Ayar değişikliği hiçbir ögeyi silmez ya da taşımaz. Sonucu olan bir değişiklik kaydedilmeden önce gösterilir.
        </p>
      </div>
      {data.visitingAsSiteAdmin ? <SiteAdminNotice /> : null}
      {/* key: a saved version comes back as fresh defaults */}
      <ChallengeForm key={JSON.stringify(data.form.edit)} {...data.form} />
    </div>
  );
}
