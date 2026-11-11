"use client";

import { Dices, ExternalLink, ListChecks } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { matchesFilter, useItemFilter } from "@/components/item-filter";
import { Button, buttonVariants } from "@/components/ui/button";
import { highlight } from "@/components/ui/highlight";
import { Modal } from "@/components/ui/modal";
import type { FilterKey } from "@/lib/search-text";
import { cn } from "@/lib/utils";
import { MediaCover } from "@/modules/media/components/media-cover";
import { MediaTitle } from "@/modules/media/components/media-title";
import { formatTitle } from "@/modules/media/titles";
import { ALONE_LINE, drawPick, emptyPickMessage, pickButtonLabel, pickLine, SPIN_LINES, type PickCandidate } from "../random-pick";

/** An item of the list on screen, as the pick weighs it: found by the page filter, left out once finished. */
export type LocalCandidate = PickCandidate & { filterKey: FilterKey; finished: boolean };

type Phase =
  | { kind: "loading" }
  | { kind: "empty"; message: string }
  | { kind: "error" }
  | { kind: "spinning"; reel: PickCandidate[]; frame: number }
  | { kind: "landed"; pick: PickCandidate; line: string };

const CONFETTI: Record<string, string[]> = {
  movie: ["🎬", "🍿", "⭐", "✨"],
  tv: ["📺", "🍿", "⭐", "✨"],
  book: ["📚", "🔖", "⭐", "✨"],
  podcast: ["🎧", "🎙️", "⭐", "✨"],
};

/** How long each frame of the reel stays: quick at first, slowing down before it lands (about two seconds in all). */
const frameDelay = (frame: number, frames: number) => 45 + Math.pow(frame / frames, 3) * 420;

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * "Bana bir şey seç": draws an item nobody finished yet, turns a reel of covers and lands on it with a
 * line from the stars. With `local` it picks from the list on screen (what its search and type filter
 * show); without, from all of the owner's lists outside the archive (`/api/lists/pick`, the type filter
 * of "Listelerim" applies).
 */
export function RandomPick({ local, className }: { local?: LocalCandidate[]; className?: string }) {
  const filter = useItemFilter();
  const type = filter?.type ?? null;
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const label = pickButtonLabel(type);

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)} aria-label={label} title={label} className={className}>
        <Dices /> <span className="hidden sm:inline">{label}</span>
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} labelledBy={headingId} className="w-[min(24rem,calc(100vw-2rem))]">
        <PickStage
          headingId={headingId}
          type={type}
          load={async () => {
            if (local) {
              const shown = local.filter((candidate) => matchesFilter(filter, candidate.filterKey));
              return { total: shown.length, candidates: shown.filter((candidate) => !candidate.finished) };
            }
            const response = await fetch(`/api/lists/pick${type ? `?type=${encodeURIComponent(type)}` : ""}`, { cache: "no-store" });
            if (!response.ok) throw new Error(String(response.status));
            return (await response.json()) as { total: number; candidates: PickCandidate[] };
          }}
          scope={local ? "list" : "all"}
          close={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}

function PickStage({
  headingId,
  type,
  load,
  scope,
  close,
}: {
  headingId: string;
  type: string | null;
  load: () => Promise<{ total: number; candidates: PickCandidate[] }>;
  scope: "list" | "all";
  close: () => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [spin, setSpin] = useState(0);
  const [spinLine] = useState(() => SPIN_LINES[Math.floor(Math.random() * SPIN_LINES.length)]);
  const candidates = useRef<PickCandidate[]>([]);
  const last = useRef<{ pick?: number; line?: number }>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function draw() {
    const pool = candidates.current;
    const { index, reel } = drawPick(pool, Math.random, { avoid: last.current.pick });
    const pick = pool[index];
    const line = pool.length === 1 ? { index: last.current.line ?? -1, text: ALONE_LINE } : pickLine(pick.media.mediaType, Math.random, last.current.line);
    last.current = { pick: index, line: line.index };
    setSpin((count) => count + 1);
    const land = () => setPhase({ kind: "landed", pick, line: line.text });
    if (reducedMotion() || reel.length <= 1) {
      land();
      return;
    }
    const turn = (frame: number) => {
      if (frame >= reel.length - 1) {
        land();
        return;
      }
      setPhase({ kind: "spinning", reel, frame });
      timer.current = setTimeout(() => turn(frame + 1), frameDelay(frame, reel.length));
    };
    turn(0);
  }

  // The candidates come once per opening; "Bir daha çevir" draws again from them.
  useEffect(() => {
    let cancelled = false;
    load().then(
      (result) => {
        if (cancelled) return;
        candidates.current = result.candidates;
        if (result.candidates.length === 0) setPhase({ kind: "empty", message: emptyPickMessage(type, result.total, scope) });
        else draw();
      },
      () => {
        if (!cancelled) setPhase({ kind: "error" });
      },
    );
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
    // Once per opening: the dialog renders this only while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const landed = phase.kind === "landed" ? phase.pick : null;
  const shown = phase.kind === "spinning" ? phase.reel[phase.frame] : landed;

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p id={headingId} className="text-sm font-medium text-muted-foreground">
        {phase.kind === "landed" ? "Bugünün seçimi" : phase.kind === "empty" || phase.kind === "error" ? "Bana bir şey seç" : spinLine}
      </p>

      <div className="relative flex min-h-56 w-full items-center justify-center">
        {shown ? (
          <div key={phase.kind === "spinning" ? `frame-${phase.frame}` : `pick-${spin}`} className="flex w-full flex-col items-center gap-2">
            {landed ? <Confetti type={landed.media.mediaType} /> : null}
            <MediaCover
              src={shown.media.imageUrl}
              title={formatTitle(shown.media)}
              icon={shown.icon}
              className={cn(
                "w-32 shadow-lg",
                phase.kind === "spinning" ? "opacity-80 motion-safe:animate-pick-flip" : "ring-4 ring-primary/70 motion-safe:animate-pick-pop",
              )}
            />
            {phase.kind === "spinning" ? <p className="max-w-full truncate text-sm text-muted-foreground">{formatTitle(shown.media)}</p> : null}
          </div>
        ) : phase.kind === "loading" ? (
          <Dices className="size-12 text-muted-foreground motion-safe:animate-spin" aria-hidden />
        ) : (
          <p className="text-sm text-muted-foreground">
            {phase.kind === "empty" ? phase.message : "Şu an seçilemedi. Biraz sonra yeniden dene."}
          </p>
        )}
      </div>

      {phase.kind === "landed" ? (
        <div role="status" className="flex w-full flex-col items-center gap-3 motion-safe:animate-pick-in">
          <p className="text-lg font-semibold text-balance">{phase.line}</p>
          <div className="min-w-0 max-w-full">
            <p data-pick-title className="font-medium leading-snug wrap-anywhere">
              <MediaTitle media={phase.pick.media} />
            </p>
            <p className="text-xs text-muted-foreground wrap-anywhere">
              {[phase.pick.media.year, phase.pick.media.creators.slice(0, 2).join(", "), phase.pick.listTitle].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" size="sm" onClick={draw}>
              <Dices /> Bir daha çevir
            </Button>
            {phase.pick.href.startsWith("#") ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  close();
                  highlight([phase.pick.key]);
                }}
              >
                <ListChecks /> Listede göster
              </Button>
            ) : (
              <Link href={phase.pick.href} onClick={close} className={buttonVariants({ size: "sm", variant: "outline" })}>
                <ListChecks /> Listede göster
              </Link>
            )}
            {phase.pick.externalUrl ? (
              <a href={phase.pick.externalUrl} target="_blank" rel="noreferrer" className={buttonVariants({ size: "sm", variant: "ghost" })}>
                <ExternalLink /> Kaynakta aç
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <Button type="button" size="sm" variant="ghost" onClick={close} className="text-muted-foreground">
        Kapat
      </Button>
    </div>
  );
}

/** A burst of the type's emoji around the cover as the pick lands (left out when motion is reduced). */
function Confetti({ type }: { type: string }) {
  const [pieces] = useState(() => {
    if (reducedMotion()) return [];
    const emoji = CONFETTI[type] ?? ["✨", "🎉", "⭐"];
    return Array.from({ length: 14 }, (_, i) => {
      const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
      const distance = 80 + Math.random() * 60;
      return {
        emoji: emoji[i % emoji.length],
        style: {
          "--x": `${Math.round(Math.cos(angle) * distance)}px`,
          "--y": `${Math.round(Math.sin(angle) * distance * 0.8)}px`,
          "--r": `${Math.round(Math.random() * 120 - 60)}deg`,
          animationDelay: `${Math.round(Math.random() * 120)}ms`,
        } as CSSProperties,
      };
    });
  });
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((piece, i) => (
        <span key={i} className="pick-confetti absolute top-1/2 left-1/2 text-xl" style={piece.style}>
          {piece.emoji}
        </span>
      ))}
    </div>
  );
}
