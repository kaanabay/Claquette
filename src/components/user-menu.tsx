import { LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { isSiteAdmin } from "@/modules/admin/access";
import { signOutAction } from "@/modules/auth/actions";
import { getCurrentUser } from "@/modules/auth/session";

export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Link href="/sign-in" className={buttonVariants({ variant: "outline", size: "sm" })}>
        Giriş yap
      </Link>
    );
  }
  const admin = await isSiteAdmin(user.id);
  return (
    <div className="flex items-center gap-3">
      {admin ? (
        <Link href="/admin" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Site yönetimi" title="Site yönetimi">
          <ShieldCheck />
        </Link>
      ) : null}
      <Link href="/account" className="flex items-center gap-3 rounded-lg hover:opacity-80" aria-label="Hesabım" title="Hesabım">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium leading-tight">{user.name}</p>
          {user.username ? <p className="text-xs text-muted-foreground">@{user.username}</p> : null}
        </div>
        <Avatar name={user.name} seed={user.id} />
      </Link>
      <form action={signOutAction}>
        <Button type="submit" variant="ghost" size="icon" aria-label="Çıkış yap" title="Çıkış yap">
          <LogOut />
        </Button>
      </form>
    </div>
  );
}
