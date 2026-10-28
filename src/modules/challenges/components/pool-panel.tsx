import { Dices, Inbox, Plus, ThumbsUp, Ticket } from "lucide-react";
import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, SectionTitle } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { toggleVoteAction } from "@/modules/entries/actions";
import { EntryCard } from "@/modules/entries/components/entry-card";
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

  return (
    <section>
      <SectionTitle
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
        Ortak havuz <span className="font-normal text-muted-foreground">({pool.candidates.length})</span>
      </SectionTitle>
      <p className="mb-4 text-sm text-muted-foreground">
        Her tur {rules.picksPerRound} öge {METHOD_TEXT[rules.selection]}.
        {rules.autoDraw ? " Yeni tur başladığında seçim otomatik yapılır." : ""}
        {round ? ` Bu turda ${pool.openSlots} boş yer var.` : ""}
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
        <div className="grid gap-3 sm:grid-cols-2">
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
                  </div>
                ) : null
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
