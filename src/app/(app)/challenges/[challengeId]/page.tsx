import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { FlashNotice } from "@/components/ui/flash-notice";
import { SectionTitle } from "@/components/ui/misc";
import { isUuid } from "@/lib/utils";
import { requireUser } from "@/modules/auth/session";
import { Board } from "@/modules/boards/components/board";
import { listBoardNotes } from "@/modules/boards/queries";
import { AddPanel } from "@/modules/challenges/components/add-panel";
import { ChallengeHeader } from "@/modules/challenges/components/challenge-header";
import { EntryBoard } from "@/modules/challenges/components/entry-board";
import { HistoryPanel } from "@/modules/challenges/components/history-panel";
import { DroppedPanel, PlanPanel, SuggestionsPanel } from "@/modules/challenges/components/plan-panel";
import { PoolPanel } from "@/modules/challenges/components/pool-panel";
import { RoundPanel } from "@/modules/challenges/components/round-panel";
import { getChallengePage, getSuggestPageData } from "@/modules/challenges/queries";
import { SortSelect } from "@/modules/media/components/sort-select";
import { listMediaTypes } from "@/modules/media/service";
import { isSortKey, type SortKey, sortRows } from "@/modules/media/sort";

export const metadata: Metadata = { title: "Ortak liste" };

export default function ChallengePage({ params, searchParams }: PageProps<"/challenges/[challengeId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Challenge params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const BOARD_SORTS: readonly SortKey[] = ["newest", "oldest", "title", "year"];

async function Challenge({ params, searchParams }: Pick<PageProps<"/challenges/[challengeId]">, "params" | "searchParams">) {
  const [{ challengeId }, query] = await Promise.all([params, searchParams]);
  const user = await requireUser();
  // ?add=1 opens the add panel; round / mode / media come from the plan's links and personal lists,
  // round + slot from a past round's missing pick.
  const link = { round: single(query.round), mode: single(query.mode), media: single(query.media), slot: single(query.slot) };
  const [data, types, adder] = await Promise.all([
    getChallengePage(user.id, challengeId),
    listMediaTypes(),
    query.add !== undefined ? getSuggestPageData(user.id, challengeId, link) : null,
  ]);
  if (!data) notFound();
  const notes = await listBoardNotes({ challengeId: data.challenge.id }, { id: user.id, canManage: data.access.canManage });

  const typeLabels = Object.fromEntries(types.map((type) => [type.slug, `${type.icon} ${type.label}`]));
  // Notices after a redirect: only ids of items that are really here count.
  const added = (single(query.added) ?? "").split(",").filter((id) => isUuid(id) && Object.hasOwn(data.titles, id));
  const removed = single(query.removed);
  const saved = single(query.saved);
  // Lists without a plan can be ordered by date, name or year (planned rounds keep their dates).
  const requestedSort = single(query.sort);
  const boardSort = isSortKey(requestedSort) && requestedSort !== "manual" ? requestedSort : "newest";

  return (
    <div className="flex flex-col gap-8">
      <ChallengeHeader data={data} typeLabels={typeLabels} adding={adder !== null} boardCount={notes.length} />
      {adder ? <AddPanel data={adder} link={link} closeHref={`/challenges/${data.challenge.id}`} /> : null}
      {added.length > 0 ? (
        <FlashNotice
          id={`added:${added.join(",")}`}
          message={added.length === 1 ? `“${data.titles[added[0]]}” eklendi.` : `${added.length} öge eklendi.`}
          highlightIds={added}
          params={["added"]}
        />
      ) : null}
      {saved && /^\d+$/.test(saved) ? <FlashNotice id={`saved:${saved}`} message="Liste ayarları kaydedildi." params={["saved"]} /> : null}
      {removed && isUuid(removed) && !Object.hasOwn(data.titles, removed) ? (
        <FlashNotice id={`removed:${removed}`} message="Öge listeden silindi." params={["removed"]} />
      ) : null}
      {data.plan ? (
        <>
          <PlanPanel data={data} />
          <SuggestionsPanel data={data} />
          <DroppedPanel data={data} />
        </>
      ) : (
        <>
          <RoundPanel data={data} />
          <HistoryPanel data={data} />
          <PoolPanel data={data} />
          <section>
            <SectionTitle action={data.entryCount > 1 ? <SortSelect value={boardSort} options={BOARD_SORTS} /> : null}>
              Ögeler <span className="font-normal text-muted-foreground">({data.entryCount})</span>
            </SectionTitle>
            <EntryBoard
              board={data.board.map((column) => ({
                ...column,
                entries: sortRows(column.entries, boardSort, (card) => ({ addedAt: card.createdAt, media: card.media })),
              }))}
            />
          </section>
        </>
      )}
      <Board
        notes={notes}
        board={{ challengeId: data.challenge.id }}
        hint="Bu listeyle ilgili notlar: aralarından seçeceğiniz yönetmenler, bağlantılar, fikirler. Herkes ekleyip düzenleyebilir; işaretlenebilir liste de olur."
      />
    </div>
  );
}
