import { Download, FileSpreadsheet, FileText, FileType, Printer } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

const item = "flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted [&_svg]:size-4 [&_svg]:text-muted-foreground";

/** Download a list as a file, or open its print view for PDF. `base` = the list's own path. */
export function ExportMenu({ base }: { base: string }) {
  return (
    <details className="relative">
      <summary className={`${buttonVariants({ variant: "outline", size: "sm" })} cursor-pointer list-none`}>
        <Download /> Dışa aktar
      </summary>
      <div className="absolute right-0 z-20 mt-2 flex w-60 flex-col gap-0.5 rounded-xl border bg-card p-2 text-sm shadow-lg">
        <a href={`${base}/export?format=xlsx`} download className={item}>
          <FileSpreadsheet /> Excel (.xlsx)
        </a>
        <a href={`${base}/export?format=csv`} download className={item}>
          <FileType /> CSV (.csv)
        </a>
        <a href={`${base}/export?format=txt`} download className={item}>
          <FileText /> Düz metin (.txt)
        </a>
        <a href={`${base}/print?auto=1`} target="_blank" rel="noopener" className={item}>
          <Printer /> PDF (yazdırma sayfası)
        </a>
      </div>
    </details>
  );
}
