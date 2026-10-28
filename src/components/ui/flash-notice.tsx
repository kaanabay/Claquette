"use client";

import { useEffect } from "react";
import { highlight } from "./highlight";
import { toast } from "./toaster";

// Hidden routes stay mounted (<Activity>) and re-run their effects when shown again: announce once.
const announced = new Set<string>();

/**
 * Announces what a redirect brought the user back for ("3 öge eklendi"), lights up those items,
 * and drops the notice's query parameters from the address bar so a reload doesn't repeat it.
 */
export function FlashNotice({
  id,
  message,
  highlightIds = [],
  params,
}: {
  /** Unique per event, e.g. the ids that were added. */
  id: string;
  message: string;
  highlightIds?: string[];
  /** Query parameters that carried the notice. */
  params: string[];
}) {
  const ids = highlightIds.join(",");
  const keys = params.join(",");

  useEffect(() => {
    if (announced.has(id)) return;
    announced.add(id);
    toast(message);
    highlight(ids ? ids.split(",") : []);
    const url = new URL(window.location.href);
    for (const key of keys.split(",")) url.searchParams.delete(key);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [id, message, ids, keys]);

  return null;
}
