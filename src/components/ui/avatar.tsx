import Link from "next/link";
import { avatarTone } from "@/lib/tones";
import { cn, initials } from "@/lib/utils";

export function Avatar({ name, seed, className }: { name: string; seed: string; className?: string }) {
  return (
    <span
      title={name}
      className={cn(
        "inline-flex size-8 shrink-0 select-none items-center justify-center rounded-full text-xs font-semibold ring-2 ring-background",
        avatarTone(seed),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/** Overlapping avatars; with `hrefFor`, each one is a link (to the person's profile). */
export function AvatarStack({
  people,
  max = 5,
  hrefFor,
}: {
  people: { id: string; name: string }[];
  max?: number;
  hrefFor?: (id: string) => string;
}) {
  const shown = people.slice(0, max);
  return (
    <span className="flex -space-x-2">
      {shown.map((person) =>
        hrefFor ? (
          <Link key={person.id} href={hrefFor(person.id)} className="rounded-full hover:z-10 hover:opacity-90">
            <Avatar name={person.name} seed={person.id} className="size-7 text-[10px]" />
            <span className="sr-only">{person.name}</span>
          </Link>
        ) : (
          <Avatar key={person.id} name={person.name} seed={person.id} className="size-7 text-[10px]" />
        ),
      )}
      {people.length > max ? (
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted text-[10px] font-medium ring-2 ring-background">
          +{people.length - max}
        </span>
      ) : null}
    </span>
  );
}
