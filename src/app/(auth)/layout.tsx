import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo className="text-xl" />
        <p className="max-w-sm text-sm text-muted-foreground">
          Arkadaşlarınla ortak kitap, film ve dizi listeleri. Sırayla öner, birlikte izle ve oku, notlarını paylaş.
        </p>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
