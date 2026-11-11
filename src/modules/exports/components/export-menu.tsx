import { Download, FileSpreadsheet, FileText, FileType, Printer } from "lucide-react";
import { Menu } from "@/components/menu";
import { buttonVariants } from "@/components/ui/button";

const item = "flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted [&_svg]:size-4 [&_svg]:text-muted-foreground";

/** Download a list as a file, or open its print view for PDF. `base` = the list's own path. */
export function ExportMenu({ base }: { base: string }) {
  return (
    <Menu
      trigger={
        <>
          <Download /> Dışa aktar
        </>
      }
      summaryClassName={buttonVariants({ variant: "outline", size: "sm" })}
      panelClassName="w-60 gap-0.5"
    >
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
    </Menu>
  );
}
