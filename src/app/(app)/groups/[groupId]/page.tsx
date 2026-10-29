import { Crown, Plus, Settings, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink, PageSkeleton } from "@/components/page-skeleton";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, SectionTitle } from "@/components/ui/misc";
import { ActivityFeed } from "@/modules/activity/components/activity-feed";
import { requireUser } from "@/modules/auth/session";
import { Board } from "@/modules/boards/components/board";
import { listBoardNotes } from "@/modules/boards/queries";
import { ChallengeCard } from "@/modules/challenges/components/challenge-card";
import { InvitePanel } from "@/modules/groups/components/invite-panel";
import { SiteAdminNotice } from "@/modules/groups/components/site-admin-notice";
import { getGroupPage } from "@/modules/groups/queries";
import { listMediaTypes } from "@/modules/media/service";
import { listWorkflowsWithStates } from "@/modules/workflows/queries";

export const metadata: Metadata = { title: "Grup" };

export default function GroupPage({ params }: PageProps<"/groups/[groupId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Group params={params} />
    </Suspense>
  );
}

async function Group({ params }: Pick<PageProps<"/groups/[groupId]">, "params">) {
  const { groupId } = await params;
  const user = await requireUser();
  const [data, types] = await Promise.all([getGroupPage(user.id, groupId), listMediaTypes()]);
  if (!data) notFound();
  const [workflowList, notes] = await Promise.all([
    listWorkflowsWithStates(groupId),
    listBoardNotes({ groupId }, { id: user.id, canManage: data.isAdmin }),
  ]);

  const { group, members, challenges, activity } = data;
  const typeIcons = Object.fromEntries(types.map((type) => [type.slug, type.icon]));
  const current = challenges.filter((summary) => summary.status !== "archived");
  const archived = challenges.filter((summary) => summary.status === "archived");
  const newChallengeHref = `/groups/${group.id}/challenges/new`;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <BackLink href="/">Ana sayfa</BackLink>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{group.name}</h1>
            {group.description ? <p className="mt-1 text-muted-foreground">{group.description}</p> : null}
            <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
              <AvatarStack people={members.map((member) => ({ id: member.userId, name: member.name }))} />
              {members.length} üye
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data.isAdmin ? (
              <Link href={`/groups/${group.id}/settings`} className={buttonVariants({ variant: "outline" })}>
                <Settings /> Ayarlar
              </Link>
            ) : null}
            <Link href={newChallengeHref} className={buttonVariants()}>
              <Plus /> Yeni ortak liste
            </Link>
          </div>
        </div>
        {data.visitingAsSiteAdmin ? <SiteAdminNotice /> : null}
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-10">
          <section>
            <SectionTitle>Ortak listeler</SectionTitle>
            {current.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {current.map((summary) => (
                  <ChallengeCard key={summary.id} summary={summary} typeIcons={typeIcons} />
                ))}
              </div>
            ) : (
              <EmptyState icon={<Sparkles />} title="İlk ortak listenizi oluşturun">
                <p>Yıllık kitap listesi, aylık yönetmen seçkisi, haftalık film takası…</p>
                <Link href={newChallengeHref} className={buttonVariants({ size: "sm", className: "mt-3" })}>
                  <Plus /> Yeni ortak liste
                </Link>
              </EmptyState>
            )}
            {archived.length > 0 ? (
              <details className="mt-6">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground">Arşiv ({archived.length})</summary>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {archived.map((summary) => (
                    <ChallengeCard key={summary.id} summary={summary} typeIcons={typeIcons} />
                  ))}
                </div>
              </details>
            ) : null}
          </section>

          <Board
            notes={notes}
            board={{ groupId: group.id }}
            hint="Grubun genel notları: birlikte izlenecekler, okunacaklar, bağlantılar. Herkes ekleyip düzenleyebilir; işaretlenebilir liste de olur."
          />

          <section>
            <SectionTitle>Son hareketler</SectionTitle>
            <ActivityFeed items={activity} />
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Davet</CardTitle>
            </CardHeader>
            <CardContent>
              <InvitePanel groupId={group.id} code={group.inviteCode} canRegenerate={data.isAdmin} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Üyeler</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-3">
                {members.map((member) => (
                  <li key={member.userId} className="flex items-center gap-3 text-sm">
                    <Avatar name={member.name} seed={member.userId} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{member.name}</span>
                      {member.username ? <span className="block text-xs text-muted-foreground">@{member.username}</span> : null}
                    </span>
                    {member.role === "owner" ? (
                      <Badge>
                        <Crown /> Kurucu
                      </Badge>
                    ) : member.role === "admin" ? (
                      <Badge>Yönetici</Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Durum akışları</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {workflowList.map((workflow) => (
                <div key={workflow.id} className="flex flex-col gap-1.5">
                  <p className="text-sm font-medium">{workflow.name}</p>
                  <div className="flex flex-wrap gap-1">
                    {workflow.states.map((state) => (
                      <Badge key={state.id} tone={state.color}>
                        {state.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
              <Link
                href={`/groups/${group.id}/workflows/new`}
                className={buttonVariants({ variant: "outline", size: "sm", className: "self-start" })}
              >
                <Plus /> Yeni akış
              </Link>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
