"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <EmptyState icon={<span className="text-4xl">🎬</span>} title="Bir şeyler ters gitti">
      <p>Sayfa yüklenirken beklenmeyen bir hata oluştu. Tekrar dener misin?</p>
      {error.digest ? <p className="mt-1 font-mono text-xs">Hata kodu: {error.digest}</p> : null}
      <Button variant="outline" size="sm" className="mt-4" onClick={() => retry()}>
        <RefreshCw /> Tekrar dene
      </Button>
    </EmptyState>
  );
}
