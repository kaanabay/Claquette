import Link from "next/link";
import { cn } from "@/lib/utils";

export const profileHref = (userId: string) => `/people/${userId}`;

/** A person's name leading to their profile (it opens for people who share a group with them). */
export function PersonLink({ id, name, className }: { id: string; name: string; className?: string }) {
  return (
    <Link href={profileHref(id)} className={cn("underline-offset-2 hover:underline", className)}>
      {name}
    </Link>
  );
}
