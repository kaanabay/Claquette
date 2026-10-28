"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Poster / cover with an emoji fallback. A plain <img> on purpose: covers come from many
 * hosts (TMDB, Google, Open Library, Apple, any manual URL), which next/image would need
 * allow-listing for, and the free image-optimization quota stays untouched.
 */
export function MediaCover({
  src,
  title,
  icon,
  className,
  style,
}: {
  src: string | null;
  title: string;
  icon: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className={cn(
        "relative aspect-[2/3] shrink-0 overflow-hidden rounded-md bg-linear-to-br from-muted to-accent ring-1 ring-border",
        className,
      )}
      style={style}
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${title} kapağı`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <span className="flex size-full items-center justify-center text-2xl" aria-hidden>
          {icon}
        </span>
      )}
    </div>
  );
}
