import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/misc";
import { safeRedirectPath } from "@/lib/utils";
import { SignInForm } from "@/modules/auth/components/sign-in-form";
import { getCurrentUser } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Giriş yap" };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <Suspense fallback={<Skeleton className="h-80" />}>
      <SignIn searchParams={searchParams} />
    </Suspense>
  );
}

async function SignIn({ searchParams }: Pick<PageProps<"/sign-in">, "searchParams">) {
  const [{ next }, user] = await Promise.all([searchParams, getCurrentUser()]);
  const target = safeRedirectPath(next);
  if (user) redirect(target);
  return <SignInForm next={target} />;
}
