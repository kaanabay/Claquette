"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A dropdown menu: a native `<details>` whose panel opens leftwards from its trigger, so it belongs at the
 * end of its row. It needs no state of its own; `MenuBehavior` (mounted once in the app layout) closes
 * every open menu when the viewer clicks or tabs elsewhere, presses Escape, opens another menu or picks
 * an item. Plain `<details>` (a spoiler, a settings section) are not menus and stay as they are.
 */
export function Menu({
  trigger,
  label,
  summaryClassName,
  panelClassName,
  className,
  children,
}: {
  trigger: ReactNode;
  /** Accessible name of the trigger when it is only an icon. */
  label?: string;
  summaryClassName?: string;
  panelClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details data-menu className={cn("relative", className)}>
      <summary className={cn("cursor-pointer list-none", summaryClassName)} aria-label={label}>
        {trigger}
      </summary>
      <div
        className={cn(
          "absolute right-0 z-20 mt-2 flex w-56 flex-col gap-1 rounded-xl border bg-card p-2 text-sm shadow-lg",
          panelClassName,
        )}
      >
        {children}
      </div>
    </details>
  );
}

const OPEN_MENU = "details[data-menu][open]";

/** Closes every open `Menu` except the one holding `keep`; `focus` returns focus to the closed menu's trigger. */
function closeMenus(keep: EventTarget | null, focus = false) {
  for (const menu of document.querySelectorAll<HTMLDetailsElement>(OPEN_MENU)) {
    if (keep instanceof Node && menu.contains(keep)) continue;
    menu.open = false;
    if (focus) menu.querySelector("summary")?.focus();
  }
}

/** Document-wide behaviour of every `Menu` on the page. Renders nothing; mount it once per layout. */
export function MenuBehavior() {
  useEffect(() => {
    // `toggle` does not bubble; the capture phase still sees it. Opening one menu closes the others.
    const onToggle = (event: Event) => {
      const menu = event.target;
      if (menu instanceof HTMLDetailsElement && menu.matches(OPEN_MENU)) closeMenus(menu);
    };
    // A click or a tab anywhere else closes the menu, even on a spot that takes no focus.
    const onPointerDown = (event: PointerEvent) => closeMenus(event.target);
    const onFocusIn = (event: FocusEvent) => closeMenus(event.target);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenus(null, true);
    };
    // Picking an item (a link, a button) closes the menu; the page may stay mounted after navigating.
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const pick = event.target.closest("a[href], button");
      if (!pick || pick.closest("summary")) return;
      const menu = pick.closest<HTMLDetailsElement>(OPEN_MENU);
      if (menu) menu.open = false;
    };
    document.addEventListener("toggle", onToggle, true);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("toggle", onToggle, true);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onClick);
    };
  }, []);
  return null;
}
