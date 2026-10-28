"use client";

import { Printer } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Once per page load: a hidden route shown again (<Activity>) must not reopen the dialog.
let printedOnLoad = false;

/** "Yazdır / PDF olarak kaydet"; with `auto`, opens the dialog once the covers had a moment to load. */
export function PrintButton({ auto }: { auto: boolean }) {
  useEffect(() => {
    if (!auto || printedOnLoad) return;
    printedOnLoad = true;
    const timer = setTimeout(() => window.print(), 600);
    return () => clearTimeout(timer);
  }, [auto]);

  return (
    <Button size="sm" onClick={() => window.print()}>
      <Printer /> Yazdır / PDF olarak kaydet
    </Button>
  );
}
