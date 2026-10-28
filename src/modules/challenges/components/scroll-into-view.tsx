"use client";

import { useEffect, useRef } from "react";

/**
 * Brings its content into view when it appears (or `scrollKey` changes). A link further down the
 * page opens the add panel at the top, and Next.js keeps the scroll position on the same page.
 */
export function ScrollIntoView({ scrollKey, children }: { scrollKey: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const top = element.getBoundingClientRect().top;
    if (top < 64 || top > window.innerHeight * 0.6) element.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [scrollKey]);
  return (
    <div ref={ref} className="scroll-mt-24">
      {children}
    </div>
  );
}
