/* eslint-disable @next/next/no-img-element -- static attribution logos from /public, shown at their own size */
import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/misc";

export const metadata: Metadata = {
  title: "Hakkında",
  description: "Claquette'in kullandığı veri kaynakları, atıflar, açık kaynak bileşenler ve verilerin nereye gittiği.",
};

const OPEN_SOURCE = [
  ["Next.js", "MIT", "https://nextjs.org"],
  ["React", "MIT", "https://react.dev"],
  ["Tailwind CSS", "MIT", "https://tailwindcss.com"],
  ["Drizzle ORM", "Apache-2.0", "https://orm.drizzle.team"],
  ["postgres.js", "Unlicense", "https://github.com/porsager/postgres"],
  ["Better Auth", "MIT", "https://www.better-auth.com"],
  ["Zod", "MIT", "https://zod.dev"],
  ["date-fns", "MIT", "https://date-fns.org"],
  ["dnd kit", "MIT", "https://dndkit.com"],
  ["fflate", "MIT", "https://github.com/101arrowz/fflate"],
  ["Lucide ikonları", "ISC", "https://lucide.dev"],
  ["Geist yazı tipi", "SIL Open Font License 1.1", "https://vercel.com/font"],
] as const;

function Source({ name, href, logo, children }: { name: string; href: string; logo?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>{name}</CardTitle>
        {logo}
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
        {children}
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="flex w-fit items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
        >
          <ExternalLink className="size-3.5" /> {href.replace(/^https:\/\/(www\.)?/, "")}
        </a>
      </CardContent>
    </Card>
  );
}

// Static page, open without an account (see proxy.ts): visitors of shared lists see the same credits.
export default function AboutPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Hakkında</h1>
        <p className="text-muted-foreground">
          Claquette, arkadaş gruplarının birlikte okuduğu kitapları, izlediği film ve dizileri takip ettiği ticari olmayan
          bir uygulama. Kitap, film ve dizi bilgilerini aşağıdaki ücretsiz servislerden alıyor. Bu sayfa hangi bilginin
          nereden geldiğini ve verilerin nereye gittiğini anlatıyor.
        </p>
      </header>

      <section>
        <SectionTitle>Veri kaynakları ve atıflar</SectionTitle>
        <div className="flex flex-col gap-3">
          <Source
            name="TMDB (The Movie Database)"
            href="https://www.themoviedb.org"
            logo={<img src="/attribution/tmdb.svg" alt="TMDB logosu" width={110} height={14} className="h-3.5 w-auto" />}
          >
            <p>Film ve dizi bilgileri, özetler ve afişler.</p>
            <p className="font-medium text-foreground">This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
            <p>Bu ürün TMDB API&apos;sini kullanır ancak TMDB tarafından onaylanmamış ya da sertifikalandırılmamıştır.</p>
          </Source>

          <Source
            name="Google Books"
            href="https://books.google.com"
            logo={
              <a href="https://www.google.com" target="_blank" rel="noreferrer" className="shrink-0 rounded bg-white px-1">
                <img src="/attribution/powered-by-google.png" alt="Powered by Google" width={62} height={30} />
              </a>
            }
          >
            <p>Kitap bilgileri ve kapakları; Türkçe baskılar için ana kaynak. Google Books&apos;tan gelen her kitabın sayfasında, Google Books&apos;taki sayfasına giden “Kaynakta aç” bağlantısı var.</p>
          </Source>

          <Source name="Open Library" href="https://openlibrary.org">
            <p>
              Kitap bilgileri ve kapakları; Internet Archive&apos;ın açık kütüphanesi. Google Books yanıt vermediğinde de sonuçlar
              buradan gelir.
            </p>
          </Source>

          <Source name="Apple Podcasts" href="https://podcasts.apple.com">
            <p>Podcast bilgileri ve kapakları, Apple&apos;ın iTunes Search API&apos;sinden. Her podcast Apple Podcasts&apos;taki sayfasına bağlanır.</p>
            <p>Apple Podcasts, Apple Inc.&apos;in ticari markasıdır.</p>
          </Source>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Afiş, kapak ve açıklamaların hakları sahiplerine aittir. Elle eklenen içerik ve görsel adresleri kullanıcılardan gelir.
          Claquette bu servislerin hiçbiriyle bağlantılı değildir ve onlar tarafından onaylanmamıştır.
        </p>
      </section>

      <section>
        <SectionTitle>Verilerin nereye gidiyor?</SectionTitle>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-muted-foreground">
          <li>
            <span className="text-foreground">Aramalar:</span> yazdığın arama metni bu uygulamanın sunucusu üzerinden ilgili servise
            gönderilir. IP adresin ve hesap bilgilerin bu servislere gitmez.
          </li>
          <li>
            <span className="text-foreground">Kapaklar ve afişler:</span> görseller tarayıcın tarafından doğrudan servislerin
            sunucularından yüklenir (image.tmdb.org, books.google.com, covers.openlibrary.org, Apple). Bu sunucular görseli isteyen
            IP adresini görebilir.
          </li>
          <li>
            <span className="text-foreground">Hesap ve listeler:</span> yalnızca bu uygulamanın veritabanında tutulur, kimseyle
            paylaşılmaz. Reklam ya da kullanım takibi aracı yoktur; tek çerez oturum çerezidir.
          </li>
          <li>
            <span className="text-foreground">Herkese açık listeler:</span> linki olan herkes görebilir ama arama motorlarına
            kapalıdır. Gizli listeleri yalnızca sahibi görür.
          </li>
          <li>
            <span className="text-foreground">Site yöneticisi:</span> uygulamayı işleten kişi, bakım ve destek için bütün grupları ve
            ortak listeleri görüp yönetebilir; unutulan bir şifreyi geçici bir şifreyle sıfırlayabilir. Yaptığı değişiklikler grubun
            akışında kendi adıyla görünür. Şifreler tek yönlü şifrelenmiş (hash) saklanır; yönetici dahil kimse göremez. Gizli
            kişisel listeler ve kişisel notlar bu yetkinin dışındadır.
          </li>
          <li>
            <span className="text-foreground">Grup yöneticileri:</span> sırayla öneri listelerinde bir üyenin önerisini onun adına
            girebilir (ör. geçmiş turları doldururken). Öge o üyenin önerisi olarak görünür; kimin girdiği grubun akışında yazar.
          </li>
        </ul>
      </section>

      <section>
        <SectionTitle>Açık kaynak</SectionTitle>
        <p className="mb-3 text-sm text-muted-foreground">Claquette şu açık kaynak projelerin üzerine kurulu:</p>
        <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {OPEN_SOURCE.map(([name, license, href]) => (
            <li key={name} className="flex items-baseline justify-between gap-3 border-b border-dashed py-1">
              <a href={href} target="_blank" rel="noreferrer" className="font-medium underline-offset-4 hover:underline">
                {name}
              </a>
              <span className="text-xs text-muted-foreground">{license}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
