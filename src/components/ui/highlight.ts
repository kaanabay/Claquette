// Lights up what was just added: cards and rows carry `data-highlight-id`, and the matching ones
// get `data-just-added` (animated in globals.css) for a moment. Client-only (touches the DOM).

const VISIBLE_FOR_MS = 3000;
const WAIT_FOR_MS = 3000;

const isShown = (element: HTMLElement) => element.checkVisibility?.() ?? element.offsetParent !== null;

/**
 * Marks the elements for these ids and scrolls the first one into view. The page may still be
 * rendering them (after a redirect or a refresh), so it waits up to a few seconds.
 */
export function highlight(ids: readonly string[]) {
  if (ids.length === 0 || typeof document === "undefined") return;
  const started = performance.now();

  const tick = () => {
    const found = ids.flatMap((id) =>
      [...document.querySelectorAll<HTMLElement>(`[data-highlight-id="${CSS.escape(id)}"]`)].filter(isShown),
    );
    if (found.length === 0) {
      if (performance.now() - started < WAIT_FOR_MS) requestAnimationFrame(tick);
      return;
    }
    for (const element of found) {
      element.dataset.justAdded = "";
      setTimeout(() => delete element.dataset.justAdded, VISIBLE_FOR_MS);
    }
    const first = found[0].getBoundingClientRect();
    if (first.top < 80 || first.bottom > window.innerHeight) found[0].scrollIntoView({ behavior: "smooth", block: "center" });
  };
  requestAnimationFrame(tick);
}
