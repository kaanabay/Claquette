import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink, PageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/modules/auth/session";
import { GroupInfoForm, MemberRow } from "@/modules/groups/components/group-settings";
import { SiteAdminNotice } from "@/modules/groups/components/site-admin-notice";
import { getGroupSettings } from "@/modules/groups/queries";

export const metadata: Metadata = { title: "Grup ayarları" };

export default function GroupSettingsPage({ params }: PageProps<"/groups/[groupId]/settings">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <GroupSettings params={params} />
    </Suspense>
  );
}

async function GroupSettings({ params }: Pick<PageProps<"/groups/[groupId]/settings">, "params">) {
  const { groupId } = await params;
  const user = await requireUser();
  const data = await getGroupSettings(user.id, groupId);
  if (!data) notFound();
  const { group, members } = data;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href={`/groups/${group.id}`}>{group.name}</BackLink>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Grup ayarları</h1>
      {data.visitingAsSiteAdmin ? <SiteAdminNotice /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Grup bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          <GroupInfoForm group={group} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Üyeler</CardTitle>
          <CardDescription>
            Yöneticiler grubun ve listelerin ayarlarını değiştirir, üyeleri yönetir ve davet kodunu yeniler. Kurucu her zaman
            yöneticidir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col">
            {members.map((member) => (
              <MemberRow key={member.userId} groupId={group.id} member={member} />
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
