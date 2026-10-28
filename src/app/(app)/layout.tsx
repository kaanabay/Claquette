import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { MainNav } from "@/components/main-nav";
import { Skeleton } from "@/components/ui/misc";
import { Toaster } from "@/components/ui/toaster";
import { UserMenu } from "@/components/user-menu";

// The shell is static (prerendered); only the user menu waits for the session.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur print:hidden">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-6">
            <Logo />
            <MainNav />
          </div>
          <Suspense fallback={<Skeleton className="h-8 w-28" />}>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 print:p-0">{children}</main>
      <footer className="border-t print:hidden">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Claquette · kitap, film ve dizi kulübün</p>
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span>Veriler:</span>
            <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" aria-label="TMDB">
              {/* eslint-disable-next-line @next/next/no-img-element -- static logo from /public */}
              <img src="/attribution/tmdb.svg" alt="TMDB" width={78} height={10} className="h-2.5 w-auto" />
            </a>
            <span>· Google Books · Open Library · Apple Podcasts ·</span>
            <Link href="/about" className="font-medium text-foreground underline underline-offset-2">
              Kaynaklar ve atıflar
            </Link>
          </p>
        </div>
      </footer>
      <Toaster />
    </>
  );
}
