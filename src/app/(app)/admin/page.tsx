import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BackLink, PageSkeleton } from "@/components/page-skeleton";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatShortDate } from "@/lib/short-date";
import { requireSiteAdmin } from "@/modules/admin/access";
import { ResetPasswordButton } from "@/modules/admin/components/reset-password-button";
import { getAdminOverview } from "@/modules/admin/queries";

export const metadata: Metadata = { title: "Site yönetimi", robots: { index: false } };

export default function AdminPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Admin />
    </Suspense>
  );
}

// Only for the usernames in SITE_ADMINS; everyone else gets a 404.
async function Admin() {
  const admin = await requireSiteAdmin();
  const { groups, users } = await getAdminOverview(admin.id);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href="/">Ana sayfa</BackLink>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Site yönetimi</h1>
        <p className="mt-1 text-muted-foreground">
          Site yöneticisi olarak her grubu yöneticisi gibi açıp ayarlarını değiştirebilirsin; yaptıkların grubun akışında senin
          adınla görünür.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gruplar ({groups.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col">
            {groups.map((group) => (
              <li key={group.id} className="border-b last:border-0">
                <Link href={`/groups/${group.id}`} className="flex items-center gap-3 py-3 text-sm hover:opacity-80">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{group.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {group.memberCount} üye · {group.activeLists} aktif liste · {formatShortDate(group.createdAt)}
                    </span>
                  </span>
                  {group.isMember ? <Badge>Üyesin</Badge> : null}
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kullanıcılar ({users.length})</CardTitle>
          <CardDescription>Şifresini unutan biri için geçici şifre oluşturabilirsin; şifreler şifrelenmiş saklandığı için kimse eskisini göremez.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col">
            {users.map((user) => (
              <li key={user.id} className="flex flex-col gap-2 border-b py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex min-w-0 items-center gap-3 text-sm">
                  <Avatar name={user.name} seed={user.id} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {user.name}
                      {user.isViewer ? <span className="font-normal text-muted-foreground"> (sen)</span> : null}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[user.username ? `@${user.username}` : null, user.email, `${user.groupCount} grup`, formatShortDate(user.createdAt)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </span>
                {user.isViewer ? null : <ResetPasswordButton userId={user.id} name={user.name} />}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
