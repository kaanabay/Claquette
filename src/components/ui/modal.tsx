"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A dialog over the page: the browser's own modal `<dialog>`, so focus stays inside, Escape closes
 * it and nothing behind it can be clicked. A click on the dimmed backdrop closes it too. Its content
 * is rendered only while it is open, so every opening starts fresh.
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** The id of the dialog's heading. */
  labelledBy: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // A route hidden by <Activity> runs its effects' cleanups: a modal left open would keep the page behind it inert.
  useEffect(() => {
    const dialog = ref.current;
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={onClose}
      // The dialog itself has no padding: a click that lands on it, not on its content, is on the backdrop.
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      className={cn(
        // The backdrop gets a plain color: ::backdrop doesn't see the page's CSS variables in every browser.
        "m-auto max-h-[calc(100dvh-2rem)] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border bg-card p-0 text-foreground shadow-xl backdrop:bg-[rgb(0_0_0/0.55)]",
        className,
      )}
    >
      {open ? <div className="p-5">{children}</div> : null}
    </dialog>
  );
}
