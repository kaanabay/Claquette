import { Download } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink, PageSkeleton } from "@/components/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import { getProfile } from "@/modules/auth/queries";
import { requireUser } from "@/modules/auth/session";
import { todayIn } from "@/modules/challenges/domain/cadence";

export const metadata: Metadata = { title: "Hesabım" };

export default function AccountPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Account />
    </Suspense>
  );
}

async function Account() {
  const user = await requireUser();
  const profile = await getProfile(user.id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <BackLink href="/">Ana sayfa</BackLink>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Hesabım</h1>

      <Card>
        <CardHeader>
          <CardTitle>{user.name}</CardTitle>
          <CardDescription>
            {[user.username ? `@${user.username}` : null, profile?.email, profile ? `${formatDate(todayIn("Europe/Istanbul", profile.joinedAt))} tarihinden beri` : null]
              .filter(Boolean)
              .join(" · ")}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verilerimi indir</CardTitle>
          <CardDescription>Her şeyin tek bir ZIP dosyasında, istediğin zaman.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
            <li>Kişisel listelerin ve üyesi olduğun gruplardaki ortak listelerin, kendi durumun ve puanınla</li>
            <li>Ögelere yazdığın notlar (yalnız sana görünenler dahil) ve panolardaki notlar</li>
            <li>Hepsi tek bir Excel çalışma kitabında (her liste ayrı sayfada), ayrıca liste liste CSV ve metin dosyaları ile programların okuyabileceği bir JSON</li>
          </ul>
          <a href="/account/export" download className={buttonVariants({ className: "self-start" })}>
            <Download /> Verilerimi indir (.zip)
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
