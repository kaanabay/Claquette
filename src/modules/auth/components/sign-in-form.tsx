"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/fields";
import { FormMessage } from "@/components/ui/form-message";
import { FreshAfterSubmit } from "@/components/ui/fresh-after-submit";
import { useFieldId } from "@/components/ui/use-field-id";
import { authClient } from "../auth-client";
import { authErrorMessage } from "../messages";

export function SignInForm(props: { next: string }) {
  return (
    <FreshAfterSubmit>
      <SignInFormInner {...props} />
    </FreshAfterSubmit>
  );
}

function SignInFormInner({ next }: { next: string }) {
  const fid = useFieldId();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const login = String(formData.get("login") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    setError(undefined);
    startTransition(async () => {
      const { error: authError } = login.includes("@")
        ? await authClient.signIn.email({ email: login.toLowerCase(), password })
        : await authClient.signIn.username({ username: login, password });
      if (authError) {
        setError(authErrorMessage(authError));
        return;
      }
      // A full load, not router.replace: links prefetched while signed out (e.g. the logo's "/")
      // still point to the sign-in redirect in the client cache.
      window.location.replace(next);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Giriş yap</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={fid("login")}>Kullanıcı adı veya e-posta</Label>
            <Input id={fid("login")} name="login" autoComplete="username" required autoFocus />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={fid("password")}>Şifre</Label>
            <Input id={fid("password")} name="password" type="password" autoComplete="current-password" required />
          </div>
          <FormMessage state={error ? { error } : undefined} />
          <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="animate-spin" /> : null}
            Giriş yap
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Hesabın yok mu?{" "}
            <Link
              href={next === "/" ? "/sign-up" : `/sign-up?next=${encodeURIComponent(next)}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Kayıt ol
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
