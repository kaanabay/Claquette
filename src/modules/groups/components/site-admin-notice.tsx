import { ShieldCheck } from "lucide-react";
import { toneClass } from "@/lib/tones";
import { cn } from "@/lib/utils";

/** Shown to the site admin on a group they don't belong to, so it's never a silent visit. */
export function SiteAdminNotice() {
  return (
    <p className={cn("flex items-start gap-2 rounded-xl p-3 text-sm ring-1 ring-inset", toneClass("sky"))}>
      <ShieldCheck className="mt-0.5 size-4 shrink-0" />
      Bu gruba site yöneticisi olarak bakıyorsun; grubun üyesi değilsin. Yaptığın değişiklikler grubun akışında senin adınla görünür.
    </p>
  );
}
