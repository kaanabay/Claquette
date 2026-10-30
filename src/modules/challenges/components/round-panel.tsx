import { ArrowRight, CircleCheck, Hourglass, UserPen } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDateRange } from "@/lib/dates";
import { MediaTitle } from "@/modules/media/components/media-title";
import { canRecordPick, slotKey } from "../domain/history";
import type { ChallengePageData } from "../queries";
import { daysLeft, describeTimeline } from "../timeline";

const FREE_TEXT: Record<string, string> = {
  open: "Bu turda herkes istediği kişiye ya da tüm gruba öneri yapabilir.",
  pool: "Bu turun seçimi ortak havuzdan yapılır.",
};

export function RoundPanel({ data }: { data: ChallengePageData }) {
  const { round, challenge, today, assignments, strategy, roundEntries } = data;

  if (!round) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Aktif tur yok</CardTitle>
          <CardDescription>
            {describeTimeline({ ...challenge, latestRound: data.rounds[0] ?? null }, today)}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const remaining = daysLeft(round.endsOn, today);
  // Group admins may enter someone else's pick for them (they said it off the app): it goes in accepted.
  const onBehalf = (pickerId: string, picks: number) =>
    data.history !== null &&
    challenge.status === "active" &&
    picks < data.history.picksPerAssignment &&
    canRecordPick({
      actorId: data.viewerId,
      pickerId,
      timing: "current",
      isParticipant: data.access.isParticipant,
      isAdmin: data.access.isAdmin,
    }).ok;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tur {round.index + 1}</CardTitle>
        <CardDescription>
          {challenge.cadenceUnit === "none"
            ? `${formatDate(round.startsOn)} tarihinde başladı · sonraki tura istediğinizde geçin`
            : formatDateRange(round.startsOn, round.endsOn)}
          {remaining ? ` · ${remaining}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {assignments.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {assignments.map((assignment) => (
              <li
                key={`${assignment.pickerId}-${assignment.recipientId ?? "group"}`}
                className="flex flex-col gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="flex items-center gap-2">
                  <Avatar name={assignment.pickerName} seed={assignment.pickerId} className="size-6 text-[10px]" />
                  <span className="font-medium">{assignment.pickerName}</span>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                  <span>{assignment.recipientName ?? "Tüm grup"}</span>
                </span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {assignment.entries.length > 0 ? (
                    <span className="flex items-center gap-1.5 text-success">
                      <CircleCheck className="size-4 shrink-0" />
                      {assignment.entries.map((entry, i) => (
                        <span key={entry.id}>
                          <Link href={`/entries/${entry.id}`} className="hover:underline">
                            <MediaTitle media={entry.media} />
                          </Link>
                          {i < assignment.entries.length - 1 ? "," : ""}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Hourglass className="size-4" /> Öneri bekleniyor
                    </span>
                  )}
                  {onBehalf(assignment.pickerId, assignment.entries.length) ? (
                    <Link
                      href={`/challenges/${challenge.id}?add=1&round=${round.index}&slot=${encodeURIComponent(slotKey(assignment))}`}
                      title={`${assignment.pickerName} adına, kabul edilmiş olarak ekle`}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      <UserPen /> Adına ekle
                    </Link>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col gap-2 text-sm">
            <p className="text-muted-foreground">{FREE_TEXT[strategy.key] ?? "Bu turda atanmış bir öneri sırası yok."}</p>
            {roundEntries.length > 0 ? (
              <p className="flex flex-wrap items-center gap-1.5">
                <CircleCheck className="size-4 text-success" />
                <span className="font-medium">{strategy.key === "pool" ? "Bu turun seçimi:" : "Bu turda:"}</span>
                {roundEntries.map((entry, i) => (
                  <span key={entry.id}>
                    <Link href={`/entries/${entry.id}`} className="hover:underline">
                      <MediaTitle media={entry.media} />
                    </Link>
                    {i < roundEntries.length - 1 ? "," : ""}
                  </span>
                ))}
              </p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
