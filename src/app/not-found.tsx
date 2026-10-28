import Link from "next/link";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <Logo className="text-xl" />
      <div>
        <p className="text-5xl">🎞️</p>
        <h1 className="mt-4 text-2xl font-semibold">Bu sahne kurgudan çıkarılmış</h1>
        <p className="mt-2 text-muted-foreground">Aradığın sayfa yok ya da görme yetkin bulunmuyor.</p>
      </div>
      <Link href="/" className={buttonVariants()}>
        Ana sayfaya dön
      </Link>
    </main>
  );
}
