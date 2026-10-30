import { Hourglass, X } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { SuggestForm } from "@/modules/media/components/suggest-form";
import type { SuggestPageData, SuggestPageParams } from "../queries";
import { ScrollIntoView } from "./scroll-into-view";

/**
 * Adding happens on the list's own page (`?add=1`, with the same `round`, `mode`, `media` and
 * `slot` parameters the plan's and the rounds' links use), so the list stays in sight and there
 * is nothing to go back to.
 */
export function AddPanel({ data, link, closeHref }: { data: SuggestPageData; link: SuggestPageParams; closeHref: string }) {
  const { options, pick } = data;
  const placement = options.allowed ? options.placement : null;
  const title = pick
    ? pick.ok && pick.timing === "current"
      ? "Adına ekle"
      : "Geçmişi doldur"
    : placement === "plan"
      ? "Listeye ekle"
      : placement === "pool"
        ? "Havuza aday ekle"
        : "Öneri yap";
  const linkKey = [link.round, link.mode, link.media, link.slot].join(":");

  return (
    <ScrollIntoView scrollKey={linkKey}>
      <section aria-label={title} className="flex flex-col gap-4 border-b pb-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            {pick?.ok ? (
              <p className="text-sm text-muted-foreground">
                «{pick.roundLabel}» turu · {pick.pickerName} → {pick.recipientName}
              </p>
            ) : !pick && options.allowed && options.remaining !== null ? (
              <p className="text-sm text-muted-foreground">{options.remaining} öneri hakkın var</p>
            ) : null}
          </div>
          <Link href={closeHref} scroll={false} className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Eklemeyi kapat">
            <X />
          </Link>
        </div>
        {pick ? (
          pick.ok ? (
            <SuggestForm
              key={linkKey}
              challengeId={data.challenge.id}
              mediaTypes={data.mediaTypes}
              targets={[]}
              placement="round"
              pick={pick}
              picks={data.picks}
              existing={data.existing}
              maxItems={pick.open}
              autoFocus
            />
          ) : (
            <EmptyState icon={<Hourglass />} title="Bu öneri eklenemiyor">
              {pick.reason}
            </EmptyState>
          )
        ) : options.allowed ? (
          <SuggestForm
            // A link with another round/mode/item starts a fresh form; a refresh after a partial add keeps it.
            key={linkKey}
            challengeId={data.challenge.id}
            mediaTypes={data.mediaTypes}
            targets={data.targets}
            placement={options.placement}
            plan={data.plan}
            picks={data.picks}
            preselected={data.preselected}
            existing={data.existing}
            maxItems={options.remaining}
            autoFocus
          />
        ) : (
          <EmptyState icon={<Hourglass />} title="Şu an ekleyemezsin">
            {options.reason}
          </EmptyState>
        )}
      </section>
    </ScrollIntoView>
  );
}
