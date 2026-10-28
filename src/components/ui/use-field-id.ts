"use client";

import { useId } from "react";

/**
 * Per-instance ids for label/control pairs. Cache Components keeps recently visited routes
 * mounted (hidden) via <Activity>, so two pages can be in the DOM at once and fixed ids
 * like "title" would collide.
 */
export function useFieldId() {
  const id = useId();
  return (name: string) => `${id}-${name}`;
}
