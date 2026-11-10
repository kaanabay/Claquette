"use client";

import { Bell, CheckCheck, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { markAllNotificationsReadAction, markNotificationReadAction } from "../actions";
import { badgeLabel } from "../domain";
import type { NotificationItem, NotificationsPage } from "../queries";

const POLL_MS = 60_000;

async function fetchPage(before?: string): Promise<NotificationsPage | null> {
  try {
    const response = await fetch(`/api/notifications${before ? `?before=${encodeURIComponent(before)}` : ""}`, { cache: "no-store" });
    return response.ok ? ((await response.json()) as NotificationsPage) : null;
  } catch {
    // Offline or a deploy in progress: keep what is shown.
    return null;
  }
}

/**
 * The bell in the header: a badge with how many notifications are unread, and the latest ones in a
 * panel. It asks on load, every minute while the tab is in view and when it opens. Opening a
 * notification (or its dot) marks it read; "Tümünü okundu yap" marks them all.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef(false);
  const pathname = usePathname();
  const [seenPath, setSeenPath] = useState(pathname);

  // Leaving the page closes the panel.
  if (pathname !== seenPath) {
    setSeenPath(pathname);
    setOpen(false);
  }

  const show = useCallback((page: NotificationsPage | null) => {
    if (!page) return;
    setUnread(page.unread);
    setItems(page.items);
    setHasMore(page.hasMore);
  }, []);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    let alive = true;
    // While the panel is open the list stays as it is; it was fetched when it opened.
    const refresh = () => {
      if (document.visibilityState !== "visible" || openRef.current) return;
      void fetchPage().then((page) => {
        if (alive) show(page);
      });
    };
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [show]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (!open) void fetchPage().then(show);
    setOpen(!open);
  }

  function markRead(item: NotificationItem) {
    if (!item.unread) return;
    setItems((list) => list?.map((other) => (other.id === item.id ? { ...other, unread: false } : other)) ?? null);
    setUnread((count) => Math.max(0, count - 1));
    void markNotificationReadAction(item.id);
  }

  function markAll() {
    setItems((list) => list?.map((item) => ({ ...item, unread: false })) ?? null);
    setUnread(0);
    void markAllNotificationsReadAction();
  }

  async function loadMore() {
    const last = items?.at(-1);
    if (!last) return;
    setLoadingMore(true);
    const page = await fetchPage(last.createdAt);
    setLoadingMore(false);
    if (!page) return;
    setItems((list) => [...(list ?? []), ...page.items.filter((item) => !list?.some((other) => other.id === item.id))]);
    setHasMore(page.hasMore);
  }

  return (
    <div ref={rootRef}>
      <Button
        ref={buttonRef}
        type="button"
        variant="ghost"
        size="icon"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread > 0 ? `Bildirimler, ${unread} okunmamış` : "Bildirimler"}
        title="Bildirimler"
        className="relative"
      >
        <Bell />
        {unread > 0 ? (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-white ring-2 ring-background"
          >
            {badgeLabel(unread)}
          </span>
        ) : null}
      </Button>
      {open ? (
        // Placed against the header's row (not the bell), so it stays on the screen on a phone.
        <div
          role="dialog"
          aria-label="Bildirimler"
          className="absolute top-full right-4 z-40 mt-1 flex w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border bg-card shadow-lg"
        >
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <p className="flex-1 font-semibold">
              Bildirimler {unread > 0 ? <span className="font-normal text-muted-foreground">({unread})</span> : null}
            </p>
            {unread > 0 ? (
              <Button type="button" size="sm" variant="outline" onClick={markAll}>
                <CheckCheck /> Tümünü okundu yap
              </Button>
            ) : null}
            <Button type="button" size="icon" variant="ghost" onClick={() => setOpen(false)} aria-label="Kapat" className="size-8">
              <X />
            </Button>
          </div>
          <div className="max-h-[min(70vh,32rem)] overflow-y-auto">
            {items === null ? (
              <p className="p-4 text-sm text-muted-foreground">Yükleniyor…</p>
            ) : items.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Henüz bildirim yok. Gruplarındaki kişiler bir şey eklediğinde, bitirdiğinde ya da not yazdığında burada görünür.
              </p>
            ) : (
              <ul className="divide-y">
                {items.map((item) => (
                  <li key={item.id} className={cn("relative flex gap-3 px-4 py-3 transition-colors hover:bg-muted/60", item.unread && "bg-accent/70")}>
                    {item.actor && item.actorId ? (
                      <Avatar name={item.actor} seed={item.actorId} className="size-9 text-xs" />
                    ) : (
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted" aria-hidden>
                        🎬
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      {/* The whole row opens it. */}
                      <Link href={item.href} onClick={() => markRead(item)} className="text-sm leading-snug after:absolute after:inset-0">
                        {item.actor ? <span className="font-semibold">{item.actor} </span> : null}
                        {item.text}
                        {item.unread ? <span className="sr-only"> (okunmadı)</span> : null}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {item.context} · {timeAgo(new Date(item.createdAt))}
                      </p>
                    </div>
                    {item.unread ? (
                      <button
                        type="button"
                        onClick={() => markRead(item)}
                        title="Okundu işaretle"
                        aria-label="Okundu işaretle"
                        className="relative z-10 -mr-1 flex size-7 shrink-0 items-center justify-center self-center rounded-full hover:bg-muted"
                      >
                        <span className="size-2.5 rounded-full bg-primary" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {hasMore && items?.length ? (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full border-t px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-60"
              >
                {loadingMore ? "Yükleniyor…" : "Daha eskiler"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
