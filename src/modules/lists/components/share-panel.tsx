"use client";

import { Check, Copy, Globe, Lock, MessageCircle, Share2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { setListVisibilityAction } from "../actions";

const subscribe = () => () => {};

/** Share link for a public list (copy, WhatsApp, the phone's share sheet), or a switch to make it public. */
export function SharePanel({ listId, title, visibility }: { listId: string; title: string; visibility: "private" | "public" }) {
  const origin = useSyncExternalStore(subscribe, () => window.location.origin, () => "");
  const canShare = useSyncExternalStore(subscribe, () => typeof navigator.share === "function", () => false);
  const [copied, setCopied] = useState(false);
  const url = `${origin}/lists/${listId}`;

  if (visibility === "private") {
    return (
      <div className="flex flex-col gap-3">
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" /> Bu liste gizli; yalnızca sen görüyorsun. Arkadaşına göstermek için herkese aç.
        </p>
        <ActionForm action={setListVisibilityAction} className="flex flex-col items-start gap-2">
          <input type="hidden" name="listId" value={listId} />
          <SubmitButton name="visibility" value="public" size="sm">
            <Globe /> Herkese aç
          </SubmitButton>
        </ActionForm>
      </div>
    );
  }

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Globe className="mt-0.5 size-4 shrink-0 text-success" /> Herkese açık: linki olan herkes görebilir, giriş yapması gerekmez.
      </p>
      <code className="block min-w-0 truncate rounded-lg bg-muted px-3 py-2 text-xs">{origin ? url : `/lists/${listId}`}</code>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? <Check /> : <Copy />} {copied ? "Kopyalandı" : "Bağlantıyı kopyala"}
        </Button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-2 rounded-md border bg-card px-3 text-xs font-medium transition-colors hover:bg-muted [&_svg]:size-4"
        >
          <MessageCircle /> WhatsApp
        </a>
        {canShare ? (
          <Button variant="outline" size="sm" onClick={() => navigator.share({ title, url }).catch(() => {})}>
            <Share2 /> Paylaş
          </Button>
        ) : null}
      </div>
      <ActionForm action={setListVisibilityAction} className="flex flex-col items-start gap-2">
        <input type="hidden" name="listId" value={listId} />
        <SubmitButton name="visibility" value="private" size="sm" variant="ghost" className="text-muted-foreground">
          <Lock /> Gizli yap
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
