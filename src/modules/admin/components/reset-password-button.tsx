"use client";

import { Copy, KeyRound } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { resetPasswordAction } from "../actions";

/** Asks in place, then shows the temporary password once so the admin can pass it on. */
export function ResetPasswordButton({ userId, name }: { userId: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setError(null);
    startTransition(async () => {
      const result = await resetPasswordAction(userId);
      if ("error" in result) setError(result.error);
      else setPassword(result.password);
      setConfirming(false);
    });
  }

  if (password) {
    return (
      <div className="flex flex-col items-start gap-1.5 text-sm sm:items-end">
        <p className="flex items-center gap-2">
          Geçici şifre: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{password}</code>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Şifreyi kopyala"
            onClick={() => navigator.clipboard.writeText(password).then(() => toast("Şifre kopyalandı."))}
          >
            <Copy />
          </Button>
        </p>
        <p className="text-xs text-muted-foreground">{name} bu şifreyle girip Hesabım’dan değiştirebilir. Bu şifre bir daha gösterilmez.</p>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-start gap-2 text-sm sm:items-end">
        <p>{name} için geçici bir şifre oluşturulsun mu? Açık oturumları kapanır.</p>
        <div className="flex gap-2">
          <Button size="sm" variant="destructive" onClick={reset} disabled={pending}>
            <KeyRound /> Evet, sıfırla
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
            Vazgeç
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
        <KeyRound /> Şifreyi sıfırla
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
