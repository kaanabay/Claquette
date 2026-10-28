import { ChevronRight, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, SectionTitle } from "@/components/ui/misc";
import { requireUser } from "@/modules/auth/session";
import { ChallengeCard } from "@/modules/challenges/components/challenge-card";
import { EntryCard } from "@/modules/entries/components/entry-card";
import { GroupCard } from "@/modules/groups/components/group-card";
import { CreateGroupForm, JoinGroupForm } from "@/modules/groups/components/group-forms";
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
  const [{ groups, turns, awaitingAnswer, sharedLists, inProgress }, types] = await Promise.all([getHome(user.id), listMediaTypes()]);
  const typeIcons = Object.fromEntries(types.map((type) => [type.slug, type.icon]));
  const firstName = user.name.split(" ")[0];
  const hasTasks = turns.length + awaitingAnswer.length > 0;

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Merhaba {firstName} 👋</h1>
        <p className="mt-1 text-muted-foreground">
          {hasTasks
            ? "Senden bir cevap bekleyenler var."
            : sharedLists.length
              ? "Ortak listelerinde şu an bunlar var."
              : groups.length
                ? "Bir gruba girip ilk ortak listeyi oluşturabilirsin."
                : "Başlamak için bir grup oluştur ya da davet koduyla katıl."}
        </p>
      </div>

      {turns.length > 0 ? (
        <section>
          <SectionTitle>Öneri sırası sende</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
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
        </section>
      ) : null}

      {awaitingAnswer.length > 0 ? (
        <section>
          <SectionTitle>Cevap bekleyen öneriler</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {awaitingAnswer.map((card) => (
              <EntryCard key={card.id} card={card} showChallenge />
            ))}
          </div>
        </section>
      ) : null}

      {sharedLists.length > 0 ? (
        <section>
          <SectionTitle>Ortak listelerin</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {sharedLists.map((summary) => (
              <ChallengeCard key={summary.id} summary={summary} typeIcons={typeIcons} showGroup />
            ))}
          </div>
        </section>
      ) : null}

      {inProgress.length > 0 ? (
        <section>
          <SectionTitle>Devam edenler</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {inProgress.map((card) => (
              <EntryCard key={card.id} card={card} showChallenge />
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div>
          <SectionTitle>Grupların</SectionTitle>
          {groups.length > 0 ? (
            <div className="flex flex-col gap-3">
              {groups.map((group) => (
                <GroupCard key={group.id} group={group} />
              ))}
            </div>
          ) : (
            <EmptyState icon={<Users />} title="Henüz bir grubun yok">
              Arkadaşlarınla bir grup kur; ortak listeleri grup içinde oluşturursunuz. Bir kişiyle de başlayabilirsin.
            </EmptyState>
          )}
        </div>
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
