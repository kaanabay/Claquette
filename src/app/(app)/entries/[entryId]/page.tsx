import { ArrowRight, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink, PageSkeleton } from "@/components/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import { ActivityFeed } from "@/modules/activity/components/activity-feed";
import { requireUser } from "@/modules/auth/session";
import { todayIn } from "@/modules/challenges/domain/cadence";
import { DeleteEntryButton } from "@/modules/entries/components/delete-entry-button";
import {
  NotesSection,
  PeopleProgress,
  PlanActions,
  ProgressPanel,
  StateActions,
  VotePanel,
} from "@/modules/entries/components/entry-panels";
import { getEntryPage } from "@/modules/entries/queries";
import { listPeople } from "@/modules/entries/tracking";
import { MediaCover } from "@/modules/media/components/media-cover";
import { MediaTitle } from "@/modules/media/components/media-title";
import { formatTitle, nativeTitle } from "@/modules/media/titles";

export const metadata: Metadata = { title: "Öge" };

const SOURCE_LABELS: Record<string, string> = {
  tmdb: "TMDB",
  google_books: "Google Books",
  open_library: "Open Library",
  itunes: "Apple Podcasts",
};

export default function EntryPage({ params }: PageProps<"/entries/[entryId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Entry params={params} />
    </Suspense>
  );
}

async function Entry({ params }: Pick<PageProps<"/entries/[entryId]">, "params">) {
  const { entryId } = await params;
  const user = await requireUser();
  const data = await getEntryPage(user.id, entryId);
  if (!data) notFound();

  const { entry, access, current, transitions, plan, people, tracking, mine, notes, votes, votedByMe, activity, canDelete } = data;
  const where = entry.roundLabel
    ? ` · ${entry.roundLabel}`
    : plan?.isSuggestion
      ? " · Önerilerde"
      : entry.isPoolCandidate
        ? " · Havuzda"
        : "";
  const media = entry.media;
  const facts = [
    media.metadata.runtimeMinutes ? `${media.metadata.runtimeMinutes} dk` : null,
    media.metadata.pageCount ? `${media.metadata.pageCount} sayfa` : null,
    media.metadata.seasons ? `${media.metadata.seasons} sezon` : null,
    media.metadata.episodes ? `${media.metadata.episodes} bölüm` : null,
    media.metadata.publisher ?? null,
  ].filter(Boolean);
  const genres = media.metadata.genres?.slice(0, 4) ?? [];

  return (
    <div className="flex flex-col gap-8">
      <BackLink href={`/challenges/${access.challenge.id}`}>{access.challenge.title}</BackLink>

      <section className="flex flex-col gap-6 sm:flex-row">
        <MediaCover src={media.imageUrl} title={formatTitle(media)} icon={entry.type.icon} className="w-40 self-start shadow-md" />
        <div className="flex min-w-0 flex-col gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              <MediaTitle media={media} />
            </h1>
            {nativeTitle(media) ? <p className="text-muted-foreground">{nativeTitle(media)}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge>
              {entry.type.icon} {entry.type.label}
            </Badge>
            {media.year ? <Badge>{media.year}</Badge> : null}
            {facts.map((fact) => (
              <Badge key={fact}>{fact}</Badge>
            ))}
            {genres.map((genre) => (
              <Badge key={genre} tone="slate">
                {genre}
              </Badge>
            ))}
          </div>
          {media.creators.length > 0 ? (
            <p className="text-sm">
              <span className="text-muted-foreground">{entry.type.creatorLabel}: </span>
              {media.creators.join(", ")}
            </p>
          ) : null}
          {media.description ? (
            <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{media.description}</p>
          ) : null}
          {media.externalUrl ? (
            <a
              href={media.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="flex w-fit items-center gap-1 text-sm underline-offset-4 hover:underline"
            >
              <ExternalLink className="size-4" /> Kaynakta aç ({SOURCE_LABELS[media.source] ?? media.source})
            </a>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{plan && !plan.isSuggestion ? "Plan" : "Öneri"}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="flex flex-wrap items-center gap-1.5 text-sm">
                <span className="font-medium">{entry.suggestedBy?.name ?? "Silinmiş kullanıcı"}</span>
                {plan ? (
                  <span>{plan.isSuggestion ? "önerdi" : "ekledi"}</span>
                ) : (
                  <>
                    <ArrowRight className="size-3.5 text-muted-foreground" />
                    <span className="font-medium">{entry.suggestedFor?.name ?? "Tüm grup"}</span>
                  </>
                )}
                <span className="text-muted-foreground">
                  · {formatDate(todayIn(access.challenge.timezone, entry.createdAt))}
                  {where}
                </span>
              </p>
              {entry.pitch ? (
                <blockquote className="border-l-2 border-primary pl-3 text-sm italic text-muted-foreground">“{entry.pitch}”</blockquote>
              ) : null}
              {plan ? <PlanActions entryId={entry.id} roundIndex={entry.roundIndex} plan={plan} dropped={current.category === "dropped"} /> : null}
              <StateActions
                entryId={entry.id}
                current={current}
                transitions={transitions}
                waiting={tracking?.overdue ? listPeople(tracking.waiting, user.id) : null}
              />
              {canDelete ? (
                <div className="border-t pt-3">
                  <DeleteEntryButton entryId={entry.id} title={formatTitle(media)} />
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notlar</CardTitle>
            </CardHeader>
            <CardContent>
              <NotesSection entryId={entry.id} notes={notes} userId={user.id} />
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Senin durumun</CardTitle>
            </CardHeader>
            <CardContent>
              <ProgressPanel entryId={entry.id} mediaType={media.mediaType} mine={mine} />
            </CardContent>
          </Card>
          {entry.isPoolCandidate && access.isParticipant ? (
            <Card>
              <CardHeader>
                <CardTitle>Oylama</CardTitle>
              </CardHeader>
              <CardContent>
                <VotePanel entryId={entry.id} votes={votes} votedByMe={votedByMe} />
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Grup</CardTitle>
            </CardHeader>
            <CardContent>
              <PeopleProgress people={people} mediaType={media.mediaType} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Geçmiş</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed items={activity} context="entry" />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
