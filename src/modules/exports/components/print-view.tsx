import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { MediaCover } from "@/modules/media/components/media-cover";
import { MediaTitle } from "@/modules/media/components/media-title";
import { formatTitle, nativeTitle } from "@/modules/media/titles";
import { type ExportDoc, type ExportItem, formatRating } from "../document";
import { PrintButton } from "./print-button";

/**
 * A list laid out for paper: the "PDF" export is the browser's "Save as PDF" on this page, which
 * keeps covers and Turkish letters without a PDF library. Opened with ?auto=1 it prints at once.
 */
export function PrintView({ doc, backHref, autoPrint }: { doc: ExportDoc; backHref: string; autoPrint: boolean }) {
  const groups: { name: string | null; items: { item: ExportItem; index: number }[] }[] = [];
  doc.items.forEach((item, index) => {
    const last = groups.at(-1);
    if (doc.kind === "challenge" && last?.name === item.group) last.items.push({ item, index });
    else if (doc.kind === "list" && last) last.items.push({ item, index });
    else groups.push({ name: doc.kind === "challenge" ? item.group : null, items: [{ item, index }] });
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 print:max-w-none print:gap-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href={backHref} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft /> Listeye dön
        </Link>
        <PrintButton auto={autoPrint} />
      </div>
      <header className="border-b pb-4">
        <h1 className="text-3xl font-semibold tracking-tight">{doc.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{doc.subtitle}</p>
      </header>
      {doc.items.length === 0 ? <p className="text-muted-foreground">Liste boş.</p> : null}
      {groups.map((group, groupIndex) => (
        <section key={groupIndex} className="flex flex-col gap-2">
          {group.name ? <h2 className="break-after-avoid text-lg font-semibold">{group.name}</h2> : null}
          <ol className="flex flex-col">
            {group.items.map(({ item, index }) => (
              <li key={index} className="flex break-inside-avoid items-start gap-3 border-b py-2.5 last:border-b-0">
                {doc.kind === "list" ? (
                  <span className="w-7 shrink-0 pt-1 text-right font-semibold tabular-nums text-muted-foreground">{item.rank ?? index + 1}</span>
                ) : null}
                <MediaCover src={item.imageUrl} title={formatTitle(item)} icon={item.icon} className="w-10" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">
                    <MediaTitle media={item} />
                    {item.year ? <span className="font-normal text-muted-foreground"> · {item.year}</span> : null}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {[nativeTitle(item), item.creators.join(", "), item.type].filter(Boolean).join(" · ")}
                  </p>
                  {doc.kind === "challenge" ? (
                    <p className="text-sm text-muted-foreground">
                      {[
                        item.status,
                        item.addedBy ? `ekleyen: ${item.addedBy}` : null,
                        item.rating !== null ? `ort. ${formatRating(item.rating)}/10 (${item.ratingCount} kişi)` : null,
                        item.myRating !== null ? `benim puanım ${item.myRating}/10` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                  {item.note ? <p className="mt-1 whitespace-pre-line text-sm italic">“{item.note}”</p> : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
      <p className="text-xs text-muted-foreground">Claquette ile hazırlandı.</p>
    </div>
  );
}
