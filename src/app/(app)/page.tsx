import { ChevronRight, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Fold, ShowMore } from "@/components/fold";
import { ItemFilterBar, ItemFilterProvider } from "@/components/item-filter";
import { PageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { requireUser } from "@/modules/auth/session";
import { ChallengeCard } from "@/modules/challenges/components/challenge-card";
import { summaryFilterKey } from "@/modules/challenges/filter-key";
import { EntryCard } from "@/modules/entries/components/entry-card";
import { entryFilterKey } from "@/modules/entries/filter-key";
import { GroupCard } from "@/modules/groups/components/group-card";
import { CreateGroupForm, JoinGroupForm } from "@/modules/groups/components/group-forms";
import { AssignedSection } from "@/modules/home/components/assigned-section";
import { getHome } from "@/modules/home/queries";
import { listMediaTypes } from "@/modules/media/service";

export default function HomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const user = await requireUser();
  const [{ groups, turns, awaitingAnswer, sharedLists, assigned }, types] = await Promise.all([getHome(user.id), listMediaTypes()]);
  const typeIcons = Object.fromEntries(types.map((type) => [type.slug, type.icon]));
  const firstName = user.name.split(" ")[0];
  const hasTasks = turns.length + awaitingAnswer.length > 0;
  const isWaitedFor = assigned !== null && assigned.overdue.length + assigned.current.length > 0;
  // What the search box looks through: the cards on this page, each once.
  const awaitingKeys = awaitingAnswer.map((card) => entryFilterKey(card, true));
  const listKeys = sharedLists.map(summaryFilterKey);
  const assignedKeys = assigned
    ? [...assigned.overdue, ...assigned.current, ...assigned.upcoming, ...assigned.offRound].map(({ card }) => entryFilterKey(card, true))
    : [];

  return (
    <div className="flex flex-col gap-10">
      <ItemFilterProvider>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Merhaba {firstName} 👋</h1>
          <p className="mt-1 text-muted-foreground">
            {hasTasks
              ? "Senden bir cevap bekleyenler var."
              : isWaitedFor
                ? "Sırada seni bekleyenler var."
                : sharedLists.length
                ? "Ortak listelerinde şu an bunlar var."
                : groups.length
                  ? "Bir gruba girip ilk ortak listeyi oluşturabilirsin."
                  : "Başlamak için bir grup oluştur ya da davet koduyla katıl."}
          </p>
          <ItemFilterBar items={[...assignedKeys, ...awaitingKeys, ...listKeys]} className="mt-4" />
        </div>

        {assigned ? <AssignedSection assigned={assigned} /> : null}

        {turns.length > 0 ? (
          <Fold remember="home-turns" title="Öneri sırası sende">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {turns.map((turn) => (
                <Link
                  key={turn.challengeId}
                  href={`/challenges/${turn.challengeId}?add=1`}
                  className="flex items-center gap-4 rounded-xl border border-primary/50 bg-accent p-4 transition-colors hover:border-primary"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Sparkles className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{turn.challengeTitle}</span>
                    <span className="block text-sm text-muted-foreground">
                      Tur {turn.roundIndex + 1} · {turn.targets.join(", ")} için öner
                      {turn.deadline ? ` · ${turn.deadline}` : ""}
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </Fold>
        ) : null}

        {awaitingAnswer.length > 0 ? (
          <Fold remember="home-awaiting" items={awaitingKeys} title="Cevap bekleyen öneriler">
            <ShowMore initial={6} items={awaitingKeys} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {awaitingAnswer.map((card) => (
                <EntryCard key={card.id} card={card} showChallenge />
              ))}
            </ShowMore>
          </Fold>
        ) : null}

        {sharedLists.length > 0 ? (
          <Fold remember="home-lists" items={listKeys} title="Ortak listelerin">
            <ShowMore initial={6} items={listKeys} className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {sharedLists.map((summary) => (
                <ChallengeCard key={summary.id} summary={summary} typeIcons={typeIcons} showGroup />
              ))}
            </ShowMore>
          </Fold>
        ) : null}
      </ItemFilterProvider>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Fold remember="home-groups" title="Grupların">
          {groups.length > 0 ? (
            <ShowMore initial={5} className="flex flex-col gap-3">
              {groups.map((group) => (
                <GroupCard key={group.id} group={group} />
              ))}
            </ShowMore>
          ) : (
            <EmptyState icon={<Users />} title="Henüz bir grubun yok">
              Arkadaşlarınla bir grup kur; ortak listeleri grup içinde oluşturursunuz. Bir kişiyle de başlayabilirsin.
            </EmptyState>
          )}
        </Fold>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Yeni grup</CardTitle>
            </CardHeader>
            <CardContent>
              <CreateGroupForm />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Bir gruba katıl</CardTitle>
            </CardHeader>
            <CardContent>
              <JoinGroupForm />
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
