import { Activity as ActivityIcon } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/misc";
import { timeAgo } from "@/lib/dates";
import { describeActivity } from "../describe";
import type { ActivityItem } from "../service";

/** `context` = "entry" when rendered on the entry page itself (no self-links, no challenge names). */
export function ActivityFeed({ items, context = "group" }: { items: ActivityItem[]; context?: "group" | "entry" }) {
  if (items.length === 0) {
    return (
      <EmptyState icon={<ActivityIcon />} title="Henüz hareket yok">
        Öneriler, durum değişiklikleri ve notlar burada görünecek.
      </EmptyState>
    );
  }
  return (
    <ol className="flex flex-col gap-4">
      {items.map((item) => {
        const text = describeActivity(item.type, item.data, Boolean(item.actorName));
        return (
          <li key={item.id} className="flex gap-3">
            {item.actorName && item.actorId ? (
              <Avatar name={item.actorName} seed={item.actorId} className="size-7 text-[10px]" />
            ) : (
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs" aria-hidden>
                🎬
              </span>
            )}
            <div className="min-w-0 text-sm leading-snug">
              <p>
                {item.actorName ? <span className="font-medium">{item.actorName} </span> : null}
                {item.actorName ? text : text.charAt(0).toLocaleUpperCase("tr-TR") + text.slice(1)}
              </p>
              <p className="mt-0.5 flex flex-wrap gap-x-1 text-xs text-muted-foreground">
                <span>{timeAgo(item.createdAt)}</span>
                {context === "group" && item.challengeTitle && item.challengeId ? (
                  <>
                    <span>·</span>
                    <Link href={`/challenges/${item.challengeId}`} className="hover:underline">
                      {item.challengeTitle}
                    </Link>
                  </>
                ) : null}
                {context === "group" && item.entryId ? (
                  <>
                    <span>·</span>
                    <Link href={`/entries/${item.entryId}`} className="hover:underline">
                      ögeye git
                    </Link>
                  </>
                ) : null}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
