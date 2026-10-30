import {
  Archive,
  ArrowLeft,
  CalendarDays,
  Info,
  LogIn,
  LogOut,
  Pause,
  Play,
  Plus,
  Repeat,
  Settings,
  SkipForward,
  SlidersHorizontal,
  StickyNote,
} from "lucide-react";
import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { AvatarStack } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { toneClass } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { ExportMenu } from "@/modules/exports/components/export-menu";
import { advanceTurnAction, joinChallengeAction, leaveChallengeAction, setChallengeStatusAction } from "../actions";
import { describeCadence } from "../domain/cadence";
import type { ChallengePageData } from "../queries";
import { addBlockedReason, CHALLENGE_STATUS_LABELS } from "../timeline";

export function ChallengeHeader({
  data,
  typeLabels,
  adding = false,
  boardCount = 0,
}: {
  data: ChallengePageData;
  typeLabels: Record<string, string>;
  /** The add panel is open below. */
  adding?: boolean;
  /** Notes on the list's board ("Pano", at the bottom of the page). */
  boardCount?: number;
}) {
  const { challenge, access, strategy, suggestion, participants, addable } = data;
  const active = participants.filter((participant) => participant.isActive);
  const isActive = challenge.status === "active";
  const hidden = <input type="hidden" name="challengeId" value={challenge.id} />;

  return (
    <header className="flex flex-col gap-5">
      <Link
        href={`/groups/${challenge.groupId}`}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {challenge.groupName}
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{challenge.title}</h1>
          {challenge.description ? <p className="mt-2 max-w-2xl text-muted-foreground">{challenge.description}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {!isActive ? <Badge tone="amber">{CHALLENGE_STATUS_LABELS[challenge.status]}</Badge> : null}
            <Badge>
              <CalendarDays /> {describeCadence({ unit: challenge.cadenceUnit, interval: challenge.cadenceInterval })}
            </Badge>
            <Badge title={strategy.summary}>
              <Repeat /> {strategy.label}
            </Badge>
            <Badge>{strategy.description}</Badge>
            <Badge>
              {challenge.mediaTypes.length
                ? challenge.mediaTypes.map((slug) => typeLabels[slug] ?? slug).join(", ")
                : "Tüm içerik türleri"}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {addable && !adding ? (
            <Link href={`/challenges/${challenge.id}?add=1`} className={buttonVariants()}>
              <Plus /> {strategy.key === "pool" ? "Havuza ekle" : data.plan ? "Listeye ekle" : "Öneri yap"}
            </Link>
          ) : null}
          {!access.isParticipant && challenge.status !== "archived" ? (
            <ActionForm action={joinChallengeAction}>
              {hidden}
              <SubmitButton>
                <LogIn /> Listeye katıl
              </SubmitButton>
            </ActionForm>
          ) : null}
          {challenge.cadenceUnit === "none" && isActive && (access.isParticipant || access.canManage) ? (
            <ActionForm action={advanceTurnAction}>
              {hidden}
              <SubmitButton variant="outline">
                <SkipForward /> Sonraki tura geç
              </SubmitButton>
            </ActionForm>
          ) : null}
          <ExportMenu base={`/challenges/${challenge.id}`} />
          {access.isParticipant || access.canManage ? (
            <details className="relative">
              <summary className={buttonVariants({ variant: "ghost", size: "icon" }) + " cursor-pointer list-none"} aria-label="Yönet">
                <Settings />
              </summary>
              <div className="absolute right-0 z-20 mt-2 flex w-56 flex-col gap-1 rounded-xl border bg-card p-2 shadow-lg">
                {access.canManage ? (
                  <Link
                    href={`/challenges/${challenge.id}/settings`}
                    className={buttonVariants({ variant: "ghost", size: "sm", className: "justify-start" })}
                  >
                    <SlidersHorizontal /> Liste ayarları
                  </Link>
                ) : null}
                {access.canManage ? (
                  <ActionForm action={setChallengeStatusAction} className="flex flex-col gap-1">
                    {hidden}
                    {challenge.status === "active" ? (
                      <SubmitButton variant="ghost" size="sm" name="status" value="paused" className="justify-start">
                        <Pause /> Duraklat
                      </SubmitButton>
                    ) : (
                      <SubmitButton variant="ghost" size="sm" name="status" value="active" className="justify-start">
                        <Play /> {challenge.status === "archived" ? "Arşivden çıkar" : "Devam ettir"}
                      </SubmitButton>
                    )}
                    {challenge.status !== "archived" ? (
                      <SubmitButton variant="ghost" size="sm" name="status" value="archived" className="justify-start">
                        <Archive /> Arşivle
                      </SubmitButton>
                    ) : null}
                  </ActionForm>
                ) : null}
                {access.isParticipant ? (
                  <ActionForm action={leaveChallengeAction} className="flex flex-col gap-1">
                    {hidden}
                    <SubmitButton variant="ghost" size="sm" className="justify-start text-destructive">
                      <LogOut /> Listeden ayrıl
                    </SubmitButton>
                  </ActionForm>
                ) : null}
              </div>
            </details>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <AvatarStack people={active.map((participant) => ({ id: participant.userId, name: participant.name }))} />
        <span>
          {strategy.key === "rotation" && active.length > 1
            ? `Sıra: ${active.map((participant) => participant.name).join(" → ")}`
            : `${active.length} katılımcı`}
        </span>
        <a href="#pano" className="flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-muted hover:text-foreground">
          <StickyNote className="size-4" /> Pano{boardCount > 0 ? ` · ${boardCount} not` : ""}
        </a>
      </div>

      {!addable && !suggestion.allowed && access.isParticipant && isActive ? (
        <p className={cn("flex items-start gap-2 rounded-xl p-3 text-sm ring-1 ring-inset", toneClass("amber"))}>
          <Info className="mt-0.5 size-4 shrink-0" />
          {addBlockedReason({
            reason: suggestion.reason,
            today: data.today,
            startsOn: challenge.startsOn,
            opensEarly: data.plan !== null || challenge.cadenceUnit !== "none",
          })}
        </p>
      ) : null}
    </header>
  );
}
