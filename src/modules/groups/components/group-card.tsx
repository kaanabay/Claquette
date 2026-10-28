import { ChevronRight, Crown, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

type GroupSummary = {
  id: string;
  name: string;
  description: string | null;
  role: "owner" | "admin" | "member";
  memberCount: number;
  activeChallenges: number;
};

export function GroupCard({ group }: { group: GroupSummary }) {
  return (
    <Link
      href={`/groups/${group.id}`}
      className="group flex items-center gap-4 rounded-xl border bg-card p-4 shadow-xs transition-colors hover:border-primary/60"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-lg font-semibold">
        {group.name.charAt(0).toLocaleUpperCase("tr-TR")}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{group.name}</p>
          {group.role === "owner" ? (
            <Badge>
              <Crown /> Kurucu
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="size-3" /> {group.memberCount} üye
          </span>
          <span>{group.activeChallenges} aktif ortak liste</span>
        </p>
      </div>
      <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
