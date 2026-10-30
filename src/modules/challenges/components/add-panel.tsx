import { Hourglass, X } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { SuggestForm } from "@/modules/media/components/suggest-form";
import type { SuggestPageData, SuggestPageParams } from "../queries";
import { AddContextBar } from "./add-context";
import { ScrollIntoView } from "./scroll-into-view";

/**
 * Adding happens on the list's own page (`?add=1`, with the same `round`, `mode`, `media` and `as`
 * parameters the plan's and the rounds' links use), so the list stays in sight and there is nothing
 * to go back to.
 */
export function AddPanel({ data, link, closeHref }: { data: SuggestPageData; link: SuggestPageParams; closeHref: string }) {
  const { options, context } = data;
  const { round, credited } = context;
  const onBehalf = !credited.isViewer;
  const title =
    context.kind === "plan"
      ? "Listeye ekle"
      : round?.timing === "past"
        ? "Geçmişi doldur"
        : onBehalf
          ? "Adına ekle"
          : context.kind === "pool"
            ? round
              ? "Tura ekle"
              : "Havuza aday ekle"
            : "Öneri yap";
  const where = [round ? `«${round.label}» turu` : null, onBehalf ? `${credited.name} adına` : null].filter(Boolean).join(" · ");
  const linkKey = [link.round, link.mode, link.media, link.as].join(":");

  return (
    <ScrollIntoView scrollKey={linkKey}>
      <section aria-label={title} className="flex flex-col gap-4 border-b pb-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            {where ? <p className="text-sm text-muted-foreground">{where}</p> : null}
            {!onBehalf && round?.timing !== "past" && options.allowed && options.remaining !== null && context.kind === "rounds" ? (
              <p className="text-sm text-muted-foreground">{options.remaining} öneri hakkın var</p>
            ) : null}
          </div>
          <Link href={closeHref} scroll={false} className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Eklemeyi kapat">
            <X />
          </Link>
        </div>
        <AddContextBar rounds={context.rounds} people={context.people} />
        {options.allowed ? (
          <SuggestForm
            // Another round, mode, item or person starts a fresh form; a refresh after a partial add keeps it.
            key={linkKey}
            challengeId={data.challenge.id}
            mediaTypes={data.mediaTypes}
            targets={data.targets}
            placement={options.placement}
            plan={data.plan}
            context={context}
            picks={data.picks}
            preselected={data.preselected}
            existing={data.existing}
            maxItems={options.remaining}
            autoFocus
          />
        ) : (
          <EmptyState icon={<Hourglass />} title={onBehalf ? `${credited.name} adına eklenemiyor` : "Şu an ekleyemezsin"}>
            {options.reason}
          </EmptyState>
        )}
      </section>
    </ScrollIntoView>
  );
}
