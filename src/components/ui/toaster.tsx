"use client";

import { CircleAlert, CircleCheck, X } from "lucide-react";
import { useSyncExternalStore } from "react";

type ToastAction = { label: string; onClick: () => void };
type ToastItem = { id: number; message: string; action?: ToastAction; isError: boolean };

// A tiny store outside React: any client code can announce something, and the notice outlives
// the component (and the page) that raised it.
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function dismiss(id: number) {
  items = items.filter((item) => item.id !== id);
  emit();
}

/**
 * A short notice at the bottom of the screen ("3 öge eklendi"), optionally with one action
 * ("Geri al"). It survives client-side navigation, so a form can announce what it did and move on.
 */
export function toast(message: string, options: { action?: ToastAction; duration?: number; isError?: boolean } = {}) {
  const id = nextId++;
  items = [...items.slice(-2), { id, message, action: options.action, isError: options.isError ?? false }];
  emit();
  setTimeout(() => dismiss(id), options.duration ?? (options.action ? 8000 : 4000));
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const NONE: ToastItem[] = [];

export function Toaster() {
  const toasts = useSyncExternalStore(subscribe, () => items, () => NONE);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 print:hidden">
      {toasts.map((item) => (
        <div
          key={item.id}
          className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl bg-foreground py-2.5 pr-2 pl-4 text-sm text-background shadow-lg motion-safe:animate-toast-in"
        >
          {item.isError ? <CircleAlert className="size-4 shrink-0 text-destructive" /> : <CircleCheck className="size-4 shrink-0 text-primary" />}
          <span className="min-w-0 flex-1">{item.message}</span>
          {item.action ? (
            <button
              type="button"
              onClick={() => {
                dismiss(item.id);
                item.action?.onClick();
              }}
              className="shrink-0 rounded-md px-2 py-1 font-semibold text-primary hover:bg-background/10"
            >
              {item.action.label}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => dismiss(item.id)}
            aria-label="Bildirimi kapat"
            className="shrink-0 rounded-md p-1 opacity-70 hover:bg-background/10 hover:opacity-100"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
