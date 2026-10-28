import { LogIn, Users } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { ActionForm } from "@/components/ui/action-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/modules/auth/session";
import { joinGroupAction } from "@/modules/groups/actions";
import { JoinGroupForm } from "@/modules/groups/components/group-forms";
import { getInvitePreview } from "@/modules/groups/queries";

export const metadata: Metadata = { title: "Davet" };

export default function JoinPage({ params }: PageProps<"/join/[code]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Join params={params} />
    </Suspense>
  );
}

// Joining is a button (POST), never a side effect of opening the link: links get prefetched.
async function Join({ params }: Pick<PageProps<"/join/[code]">, "params">) {
  const { code } = await params;
  const user = await requireUser();
  const preview = /^[a-zA-Z0-9]{4,32}$/.test(code) ? await getInvitePreview(user.id, code) : null;

  if (!preview) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <EmptyState icon={<Users />} title="Davet kodu geçersiz">
          Kod yenilenmiş olabilir. Grubundan yeni bir bağlantı iste ya da kodu aşağıya yaz.
        </EmptyState>
        <JoinGroupForm />
      </div>
    );
  }
  if (preview.isMember) redirect(`/groups/${preview.id}`);

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardDescription>Seni bir gruba davet ettiler</CardDescription>
        <CardTitle className="text-2xl">{preview.name}</CardTitle>
        <CardDescription>{preview.memberCount} üye</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {preview.description ? <p className="text-sm text-muted-foreground">{preview.description}</p> : null}
        <ActionForm action={joinGroupAction} className="flex flex-col gap-3">
          <input type="hidden" name="code" value={code} />
          <SubmitButton size="lg">
            <LogIn /> Gruba katıl
          </SubmitButton>
        </ActionForm>
      </CardContent>
    </Card>
  );
}
