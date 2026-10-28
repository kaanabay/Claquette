"use client";

import { Check, Copy, RefreshCw } from "lucide-react";
import { useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { regenerateInviteAction } from "../actions";

export function InvitePanel({ groupId, code, canRegenerate }: { groupId: string; code: string; canRegenerate: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/join/${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Arkadaşların bu kodla ya da davet bağlantısıyla gruba katılabilir.</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded-lg bg-muted px-3 py-2 font-mono text-base tracking-[0.2em]">{code}</code>
        <Button variant="outline" size="sm" onClick={copyLink}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Kopyalandı" : "Bağlantıyı kopyala"}
        </Button>
      </div>
      {canRegenerate ? (
        <ActionForm action={regenerateInviteAction} className="flex flex-col items-start gap-2">
          <input type="hidden" name="groupId" value={groupId} />
          <SubmitButton variant="ghost" size="sm" className="text-muted-foreground">
            <RefreshCw /> Kodu yenile
          </SubmitButton>
        </ActionForm>
      ) : null}
    </div>
  );
}
