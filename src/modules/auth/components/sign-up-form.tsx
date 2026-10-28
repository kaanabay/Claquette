"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/fields";
import { FieldError, FormMessage } from "@/components/ui/form-message";
import { FreshAfterSubmit } from "@/components/ui/fresh-after-submit";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFieldId } from "@/components/ui/use-field-id";
import { useFormAction } from "@/components/ui/use-form-action";
import { signUpAction } from "../actions";

export function SignUpForm(props: { next: string; requiresCode: boolean }) {
  return (
    <FreshAfterSubmit>
      <SignUpFormInner {...props} />
    </FreshAfterSubmit>
  );
}

function SignUpFormInner({ next, requiresCode }: { next: string; requiresCode: boolean }) {
  const { state, pending, formProps } = useFormAction(signUpAction);
  const fid = useFieldId();
  const errors = state?.fieldErrors;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kayıt ol</CardTitle>
      </CardHeader>
      <CardContent>
        <form {...formProps} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <div className="flex flex-col gap-2">
            <Label htmlFor={fid("name")}>Adın</Label>
            <Input id={fid("name")} name="name" autoComplete="name" required maxLength={60} aria-invalid={Boolean(errors?.name)} />
            <FieldError errors={errors?.name} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={fid("username")}>Kullanıcı adı</Label>
            <Input
              id={fid("username")}
              name="username"
              autoComplete="username"
              required
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9_.]+"
              aria-invalid={Boolean(errors?.username)}
            />
            <FieldError errors={errors?.username} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={fid("email")}>E-posta</Label>
            <Input id={fid("email")} name="email" type="email" autoComplete="email" required aria-invalid={Boolean(errors?.email)} />
            <FieldError errors={errors?.email} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={fid("password")}>Şifre</Label>
            <Input
              id={fid("password")}
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              aria-invalid={Boolean(errors?.password)}
            />
            {errors?.password ? (
              <FieldError errors={errors.password} />
            ) : (
              <p className="text-xs text-muted-foreground">En az 8 karakter.</p>
            )}
          </div>
          {requiresCode ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor={fid("registrationCode")}>Kayıt kodu</Label>
              <Input id={fid("registrationCode")} name="registrationCode" required aria-invalid={Boolean(errors?.registrationCode)} />
              <p className="text-xs text-muted-foreground">Uygulamayı kuran kişiden alabilirsin.</p>
            </div>
          ) : null}
          <FormMessage state={state} />
          <SubmitButton pending={pending}>Hesap oluştur</SubmitButton>
          <p className="text-center text-sm text-muted-foreground">
            Zaten hesabın var mı?{" "}
            <Link
              href={next === "/" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(next)}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Giriş yap
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
