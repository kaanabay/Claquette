import { Dices, Inbox, Plus, ThumbsUp, Ticket } from "lucide-react";
import Link from "next/link";
import { Fold, ShowMore } from "@/components/fold";
import { FilterEmpty, FilteredCount } from "@/components/item-filter";
import { ActionForm } from "@/components/ui/action-form";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { toggleVoteAction } from "@/modules/entries/actions";
import { EntryCard } from "@/modules/entries/components/entry-card";
import { entryFilterKey } from "@/modules/entries/filter-key";
import { TakeOffRoundButton } from "@/modules/entries/components/off-round-buttons";
import { formatTitle } from "@/modules/media/titles";
import { drawFromPoolAction, selectPoolEntryAction } from "../actions";
import type { ChallengePageData } from "../queries";

const METHOD_TEXT = {
  votes: "en çok oy alanlar arasından seçilir (eşitlikte kura)",
  random: "kurayla seçilir",
  manual: "elle seçilir",
} as const;

export function PoolPanel({ data }: { data: ChallengePageData }) {
  const { pool, challenge, access, round, suggestion } = data;
  if (!pool) return null;

  const canAct = access.isParticipant && challenge.status === "active";
  const canSelect = canAct && round !== null && pool.openSlots > 0;
  const { rules } = pool;
  const keys = pool.candidates.map((card) => entryFilterKey(card));

  return (
    <Fold
      remember="pool"
      title={
        <>
          Ortak havuz{" "}
          <span className="font-normal text-muted-foreground">
            (<FilteredCount items={keys} />)
          </span>
        </>
      }
      action={
          canSelect && pool.candidates.length > 0 && rules.selection !== "manual" ? (
            <ActionForm action={drawFromPoolAction} className="flex flex-col items-end gap-1">
              <input type="hidden" name="challengeId" value={challenge.id} />
              <SubmitButton size="sm">
                <Dices /> {rules.selection === "votes" ? "En çok oy alanı seç" : "Kura çek"}
              </SubmitButton>
            </ActionForm>
          ) : null
      }
    >
      <p className="mb-4 text-sm text-muted-foreground">
        Her tur {rules.picksPerRound} öge {METHOD_TEXT[rules.selection]}.
        {rules.autoDraw ? " Yeni tur başladığında seçim otomatik yapılır." : ""}
        {round ? ` Bu turda ${pool.openSlots} boş yer var.` : ""} Birinizin tek başına bitirdiği aday havuzdan çıkar, tur dışına geçer.
      </p>

      {pool.candidates.length === 0 ? (
        <EmptyState icon={<Inbox />} title="Havuz boş">
          {suggestion.allowed ? (
            <Link href={`/challenges/${challenge.id}?add=1`} className={buttonVariants({ size: "sm", className: "mt-2" })}>
              <Plus /> Havuza ilk adayı ekle
            </Link>
          ) : (
            "Katılımcılar aday ekledikçe burada görünecek."
          )}
        </EmptyState>
      ) : (
        <ShowMore initial={6} items={keys} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {pool.candidates.map((card) => (
            <EntryCard
              key={card.id}
              card={card}
              showState={false}
              footer={
                canAct ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {rules.selection === "votes" ? (
                      <ActionForm action={toggleVoteAction} className="flex flex-col gap-1">
                        <input type="hidden" name="entryId" value={card.id} />
                        <SubmitButton size="sm" variant={card.votedByMe ? "default" : "outline"} aria-pressed={card.votedByMe}>
                          <ThumbsUp /> {card.votes}
                        </SubmitButton>
                      </ActionForm>
                    ) : null}
                    {canSelect ? (
                      <ActionForm action={selectPoolEntryAction} className="flex flex-col gap-1">
                        <input type="hidden" name="entryId" value={card.id} />
                        <SubmitButton size="sm" variant="ghost">
                          <Ticket /> Bu tura seç
                        </SubmitButton>
                      </ActionForm>
                    ) : null}
                    <TakeOffRoundButton entryId={card.id} title={formatTitle(card.media)} variant="ghost" />
                  </div>
                ) : null
              }
            />
          ))}
        </ShowMore>
      )}
      <FilterEmpty items={keys} />
    </Fold>
  );
}
