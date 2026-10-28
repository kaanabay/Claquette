import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/misc";
import { safeRedirectPath } from "@/lib/utils";
import { SignUpForm } from "@/modules/auth/components/sign-up-form";
import { getCurrentUser } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Kayıt ol" };

export default function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  return (
    <Suspense fallback={<Skeleton className="h-[30rem]" />}>
      <SignUp searchParams={searchParams} />
    </Suspense>
  );
}

async function SignUp({ searchParams }: Pick<PageProps<"/sign-up">, "searchParams">) {
  const [{ next }, user] = await Promise.all([searchParams, getCurrentUser()]);
  const target = safeRedirectPath(next);
  if (user) redirect(target);
  return <SignUpForm next={target} requiresCode={Boolean(process.env.REGISTRATION_CODE)} />;
}
