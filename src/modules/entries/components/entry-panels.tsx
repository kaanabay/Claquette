import { CalendarPlus, Clock, Lock, MoveRight, ThumbsUp, Trash, Undo2 } from "lucide-react";
import { ActionForm } from "@/components/ui/action-form";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { timeAgo } from "@/lib/dates";
import { formatShortDate } from "@/lib/short-date";
import { dotClass } from "@/lib/tones";
import { PlaceForm } from "@/modules/challenges/components/place-form";
import {
  changeEntryStateAction,
  deleteNoteAction,
  toggleVoteAction,
  unplanEntryAction,
  updateProgressAction,
} from "../actions";
import { progressLabel, type ProgressStatus } from "../labels";
import type { EntryPageData } from "../queries";
import { FinishedOnEditor } from "./finished-on-editor";
import { NoteForm } from "./note-form";
import { ReturnFromOffRoundButton, TakeOffRoundButton } from "./off-round-buttons";
import { ProgressButtons } from "./progress-buttons";

export function StateActions({
  entryId,
  current,
  transitions,
  waiting = null,
}: {
  entryId: string;
  current: EntryPageData["current"];
  transitions: EntryPageData["transitions"];
  /** Who hasn't finished it yet, when its round is over ("Zamanı geçti"). */
  waiting?: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        Şu anki durum <Badge tone={current.color}>{current.label}</Badge>
        {waiting ? (
          <>
            <Badge tone="amber">
              <Clock /> Zamanı geçti
            </Badge>
            <span className="text-xs text-muted-foreground">Henüz bitirmeyen: {waiting}</span>
          </>
        ) : null}
      </p>
      {transitions.length > 0 ? (
        <ActionForm action={changeEntryStateAction} className="flex flex-wrap gap-2">
          <input type="hidden" name="entryId" value={entryId} />
          {transitions.map((state) => (
            <SubmitButton key={state.id} name="stateId" value={state.id} size="sm" variant="outline">
              <span className={`size-2 rounded-full ${dotClass(state.color)}`} aria-hidden />
              {state.label}
            </SubmitButton>
          ))}
        </ActionForm>
      ) : (
        <p className="text-xs text-muted-foreground">Bu ögenin durumunu şu an değiştiremezsin.</p>
      )}
    </div>
  );
}

/** Planning lists: accept a suggestion into a round, move a planned item, or take it back out. */
export function PlanActions({
  entryId,
  roundIndex,
  plan,
  dropped,
}: {
  entryId: string;
  roundIndex: number | null;
  plan: NonNullable<EntryPageData["plan"]>;
  dropped: boolean;
}) {
  if (dropped) return null;
  if (plan.isOffRound) {
    return plan.canMove ? (
      <div className="flex flex-col gap-2">
        <p className="text-sm">Bir tura al</p>
        <PlaceForm
          entryId={entryId}
          options={plan.options}
          defaultIndex={plan.defaultIndex}
          askFinished={plan.askFinished}
          participantCount={plan.participantCount}
          label={
            <>
              <CalendarPlus /> Tura al
            </>
          }
        />
      </div>
    ) : null;
  }
  if (plan.isSuggestion) {
    return plan.canAccept ? (
      <div className="flex flex-col gap-2">
        <p className="text-sm">Bu öneriyi hangi tura alalım?</p>
        <PlaceForm
          entryId={entryId}
          options={plan.options}
          defaultIndex={plan.defaultIndex}
          participantCount={plan.participantCount}
          label={
            <>
              <CalendarPlus /> Plana ekle
            </>
          }
        />
      </div>
    ) : (
      <p className="text-xs text-muted-foreground">Bu öneriyi listedeki başka biri kabul edip bir tura yerleştirecek.</p>
    );
  }
  if (!plan.canMove) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">Başka bir tura taşı</p>
      <div className="flex flex-wrap items-center gap-2">
        <PlaceForm
          entryId={entryId}
          options={plan.options}
          defaultIndex={plan.defaultIndex}
          currentIndex={roundIndex}
          askFinished={plan.askFinished}
          participantCount={plan.participantCount}
          label={
            <>
              <MoveRight /> Taşı
            </>
          }
        />
        <ActionForm action={unplanEntryAction} className="flex flex-col gap-1" messageClassName="text-xs">
          <input type="hidden" name="entryId" value={entryId} />
          <SubmitButton
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            title="Öge yeniden öneri olur; listedeki diğerleri kabul edip bir tura yerleştirir."
          >
            <Undo2 /> Önerilere geri al
          </SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}

/**
 * "Tur dışı": an item taken out of the rounds stays in the list and everyone finishes it on their own
 * time. Offers taking it out, or bringing it back to the pool / the suggestions while it is open.
 */
export function OffRoundActions({ entryId, title, offRound }: { entryId: string; title: string; offRound: EntryPageData["offRound"] }) {
  if (offRound.place === "off") {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-muted-foreground">Turlara girmez; herkes kendi zamanında bitirip işaretler. Herkes bitirince ya da pas geçince tamamlanır.</p>
        {offRound.backTo ? <ReturnFromOffRoundButton entryId={entryId} title={title} to={offRound.backTo} /> : null}
      </div>
    );
  }
  if (!offRound.canTakeOff) return null;
  return (
    <div className="flex flex-col items-start gap-1.5 border-t pt-3">
      <TakeOffRoundButton entryId={entryId} title={title} />
      <p className="text-xs text-muted-foreground">
        {offRound.place === "round"
          ? "Turundan çıkar ama listede kalır; herkes kendi zamanında bitirir. Ör. sadece biriniz izlediyse."
          : "Turlara girmez ama listede kalır; herkes kendi zamanında bitirir. Ör. sadece biriniz izlediyse."}
      </p>
    </div>
  );
}

export function ProgressPanel({
  entryId,
  title,
  mediaType,
  mine,
}: {
  entryId: string;
  title: string;
  mediaType: string;
  mine: { status: ProgressStatus; rating: number | null; completedAt: Date | null } | null;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <ProgressButtons entryId={entryId} title={title} mediaType={mediaType} status={mine?.status ?? null} />
        {mine?.status === "completed" ? <FinishedOnEditor entryId={entryId} completedAt={mine.completedAt} /> : null}
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">
          Puanın{" "}
          <span className="font-normal text-muted-foreground">{mine?.rating ? `${mine.rating}/10` : "(1–10)"}</span>
        </p>
        <ActionForm action={updateProgressAction} className="flex flex-wrap gap-1">
          <input type="hidden" name="entryId" value={entryId} />
          {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
            <SubmitButton
              key={value}
              name="rating"
              value={value}
              size="sm"
              className="w-8 px-0"
              variant={mine?.rating === value ? "default" : (mine?.rating ?? 0) > value ? "secondary" : "outline"}
              aria-label={`${value} puan`}
            >
              {value}
            </SubmitButton>
          ))}
          {mine?.rating ? (
            <SubmitButton name="rating" value={0} size="sm" variant="ghost">
              Kaldır
            </SubmitButton>
          ) : null}
        </ActionForm>
      </div>
    </div>
  );
}

export function PeopleProgress({ people, mediaType }: { people: EntryPageData["people"]; mediaType: string }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {people.map((person) => (
        <li key={person.userId} className="flex items-center justify-between gap-3 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <Avatar name={person.name} seed={person.userId} className="size-6 text-[10px]" />
            <span className="truncate">{person.name}</span>
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {person.progress ? progressLabel(person.progress.status, mediaType) : "Başlamadı"}
            {person.progress?.status === "completed" && person.progress.completedAt ? ` · ${formatShortDate(person.progress.completedAt)}` : ""}
            {person.progress?.rating ? ` · ${person.progress.rating}/10` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function VotePanel({ entryId, votes, votedByMe }: { entryId: string; votes: number; votedByMe: boolean }) {
  return (
    <ActionForm action={toggleVoteAction} className="flex flex-col items-start gap-2">
      <input type="hidden" name="entryId" value={entryId} />
      <p className="text-sm text-muted-foreground">Bu öge ortak havuzda; oy ver ki sıradaki tura seçilsin.</p>
      <SubmitButton size="sm" variant={votedByMe ? "default" : "outline"} aria-pressed={votedByMe}>
        <ThumbsUp /> {votedByMe ? "Oy verdin" : "Oy ver"} · {votes}
      </SubmitButton>
    </ActionForm>
  );
}

export function NotesSection({ entryId, notes, userId }: { entryId: string; notes: EntryPageData["notes"]; userId: string }) {
  return (
    <div className="flex flex-col gap-4">
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz not yok. Düşüncelerini ilk sen yaz.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-xl border bg-card p-3">
              <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="flex flex-wrap items-center gap-2">
                  <Avatar name={note.authorName} seed={note.authorId} className="size-6 text-[10px]" />
                  <span className="font-medium text-foreground">{note.authorName}</span>
                  <span>{timeAgo(note.createdAt)}</span>
                  {note.visibility === "private" ? (
                    <Badge>
                      <Lock /> Sadece sen
                    </Badge>
                  ) : null}
                </span>
                {note.authorId === userId ? (
                  <ActionForm action={deleteNoteAction}>
                    <input type="hidden" name="noteId" value={note.id} />
                    <SubmitButton variant="ghost" size="icon" aria-label="Notu sil" className="size-7">
                      <Trash />
                    </SubmitButton>
                  </ActionForm>
                ) : null}
              </div>
              {note.isSpoiler ? (
                <details>
                  <summary className="cursor-pointer text-sm text-muted-foreground">
                    ⚠️ Spoiler içeriyor, göstermek için tıkla
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{note.body}</p>
                </details>
              ) : (
                <p className="whitespace-pre-wrap text-sm">{note.body}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <NoteForm entryId={entryId} />
    </div>
  );
}
