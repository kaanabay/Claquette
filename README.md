# 🎬 Claquette

Arkadaşlarınla birlikte okuduğun kitapları, izlediğin film ve dizileri (ve ileride ekleyeceğin her tür medyayı) yönettiğin bir web uygulaması. İki tür liste var:

- **Ortak listeler** grubun: turları, seçim kuralı, durumları ve puanları olan listeler. Aralıkta belirlenen yıllık dört kitap, ay sonunda birlikte seçilen yönetmen filmi, haftalık film takası ya da oylamalı bir havuz; hepsi aynı motorla kuruluyor. Kurallar koda gömülü değil, veride duruyor.
- **Kişisel listeler** senin: izlenecekler, yıl sonu Top 10… Tur ve tarih yok; istersen herkese açıp linkini paylaşırsın.

Başlangıçta iki kişi için tasarlandı; grup, katılımcı, liste kuralı ve medya türü sayısı büyüdükçe veri modelini değiştirmek gerekmiyor.

## Özellikler

- **Gruplar ve davet:** Grup kur, 8 haneli kodu ya da davet bağlantısını paylaş. Bir kişi birden fazla grupta olabilir.
- **Ayarlar ve yönetim:** Grup yöneticileri grubun adını ve açıklamasını değiştirir, üyeleri yönetici yapar ya da gruptan çıkarır. Listeyi kuran ve yöneticiler listenin ayarlarını sonradan değiştirir (başlık, türler, bitiş tarihi, kural ayarları, katılımcılar); sonucu olan değişiklik kaydedilmeden önce gösterilir ve hiçbir değişiklik öge silmez ya da taşımaz. `SITE_ADMINS`'teki site yöneticisi bütün grupları yönetir ve `/admin`'den şifre sıfırlar; herkes "Hesabım"dan şifresini değiştirir.
- **Ortak liste motoru:**
  - *Sıklık:* haftalık, iki haftalık, aylık, çeyreklik, yıllık, özel ("10 günde bir") ya da süresiz. Her periyot bir **tur** olur. Liste geçmiş bir tarihten de başlayabilir.
  - *Seçim kuralı:* **Birlikte belirliyoruz** (sıra yok; anlaştığınızı plana eklersiniz, aklınıza geleni öneri olarak bırakırsınız), **Sırayla öneri** (karşılıklı takas, zincir ya da her tur tek seçici), **Serbest öneri** (tur başına limitli ya da limitsiz), **Ortak havuz** (oylama, kura ya da elle seçim; yeni tur başlayınca otomatik seçim).
  - *Planlama* ("Birlikte belirliyoruz"): turlar önceden ve geriye dönük doldurulur, boş bırakılır, öge başka bir tura taşınır. Geçmiş bir tura eklerken kimin bitirdiği sorulur ("Hepimiz bitirdik" varsayılan); böylece eski okumalarınızı da girebilirsiniz. Öneriyi listedeki başka biri kabul edip bir tura yerleştirir.
- **Ekleme:** Listenin kendi sayfasında açılan panelde aramada istediğin kadar sonucu seç (Enter ilk sonucu seçer); seçtiklerin yeni aramada kaybolmaz, × ile çıkarırsın, tek tıkla hepsi eklenir ve listede vurgulanır. Listede zaten olan öge işaretlenir ve ikinci kez eklenemez. Yanlış eklenen öge silinebilir; kişisel listeden çıkarılan "Geri al" ile döner.
- **Pano:** Ortak listenin ve grubun yanında herkesin yazıp düzenleyebildiği notlar: aralarından seçeceğiniz yönetmenler, bağlantılar, fikirler. İşaretlenebilir listeler (Google Keep'ten yapıştırılanlar dahil), sabitleme, geri alınabilir silme.
- **Dışa aktarma:** Her liste Excel (.xlsx), CSV ve düz metin olarak iner; PDF için yazdırma sayfası. "Hesabım"dan bütün verilerin tek bir ZIP olarak iner: her liste ayrı sayfada bir Excel çalışma kitabı, liste liste CSV ve metin dosyaları, notlar, panolar ve JSON.
- **İsimler:** Her yerde özgün ad önde, Türkçe ad parantez içinde: "La dolce vita (Tatlı Hayat)"; Rusça, Japonca gibi alfabelerde Latin karşılığı: "Stalker (İz Sürücü)".
- **Tarih, sezon, sıralama:** Her ögenin eklendiği gün görünür; kişisel listede değiştirilebilir ve eklerken seçilebilir. Diziler sezon sezon eklenebilir ("Lost · 2. Sezon"). Kişisel listeler elle, tarihe, başlığa ya da yıla göre sıralanır; "İzlediklerim" gibi bir liste tarih sırasıyla bir günlük olur.
- **Kişisel listeler:** sıralı (numaralı) ya da sırasız; sürükleyerek sıralama, ögeye not, gizli ya da herkese açık. Herkese açık bir listenin linki giriş yapmadan açılır ve WhatsApp'ta başlık ve kapaklarla önizlenir. Kişisel listedeki bir ögeyi tek dokunuşla ortak listeye önerebilir, ortak listeye eklerken "Listelerimden" seçebilirsin.
- **Esnek durum akışları:** Varsayılan akış *Önerildi → Kabul Edildi → Tamamlandı / Reddedildi*. Grup kendi akışını (ör. "Okunuyor" adımıyla) arayüzden oluşturabilir.
- **Takip:** Zaman çerçeveyi verir, tamamlanmayı kişiler belirler. Herkes kendi durumunu (Sırada / Okuyorum / Okudum / Yarım bıraktım) ve 1–10 puanını işaretler; liste kartındaki tek dokunuşluk "İzledim/Okudum" düğmesi geri alınabilir. Öge, ait olduğu herkes bitirince "Tamamlandı" olur, biri işaretini geri alırsa yeniden açılır. Turu bitmiş ama bitirmeyeni olan öge "Zamanı geçti" diye görünür; kartta kimlerin bitirdiği görünür.
- **Notlar:** Grupla paylaşılan ya da sadece sana görünen notlar, spoiler gizleme.
- **Otomatik veri + elle ekleme:** TMDB (film/dizi; Türkçe ve İngilizce adla arama, "Stalker 1979" gibi yıl filtresi), Google Books ve Open Library (kitap), Apple Podcasts (podcast). Bulunamayan ya da kaynağı olmayan içerik (oyun, bağımsız yapımlar…) için elle ekleme her zaman açık.
- **Şeffaflık:** "Hakkında" sayfası (`/about`, oturumsuz açılır) tüm veri kaynaklarını ve atıflarını, kullanılan açık kaynak bileşenleri ve verilerin nereye gittiğini anlatıyor; alt bilgi her sayfadan buraya bağlanıyor.
- **Ana sayfa:** en üstte "Bana atananlar": sana ait olup henüz bitirmediklerin; zamanı geçenler, devam edenler ve her listenin sıradaki turu, karttan tek dokunuşla işaretlenir. Altında ortak listelerinde şu an ne olduğu (bu turun ögeleri, kalan süre, sıradaki turlar), cevap bekleyen öneriler, sıranın sende olduğu listeler. Grup sayfasında olay akışı.
- Mobil uyumlu, açık/koyu tema, Türkçe arayüz.

## Teknolojiler

| Katman | Seçim |
| --- | --- |
| Uygulama | Next.js 16 (App Router, Server Components, Server Actions, Cache Components) · React 19 · TypeScript |
| Arayüz | Tailwind CSS v4 · shadcn/ui tarzında projede duran bileşenler · lucide ikonları |
| Veritabanı | PostgreSQL (Neon ya da Supabase) · Drizzle ORM · drizzle-kit migration'ları |
| Kimlik doğrulama | Better Auth: kullanıcı adı + şifre, oturumlar ve giriş denemesi limiti veritabanında |
| Doğrulama ve test | Zod 4 · Vitest |
| Barındırma | Vercel Hobby + Neon Free (sıfır maliyet) |

Seçimlerin gerekçeleri için [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), veri modeli için [docs/DATA_MODEL.md](docs/DATA_MODEL.md), canlıya alma için [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Lokalde çalıştırma

**Gereksinimler:** Node.js 20.9+ (22 önerilir) ve bir PostgreSQL veritabanı.

```bash
npm install
cp .env.example .env.local   # Windows PowerShell: Copy-Item .env.example .env.local
```

`.env.local` dosyasını doldur (açıklamalar dosyanın içinde):

| Değişken | Zorunlu | Not |
| --- | --- | --- |
| `DATABASE_URL` | ✔ | PostgreSQL bağlantı adresi |
| `BETTER_AUTH_SECRET` | ✔ | En az 32 karakterlik rastgele değer |
| `BETTER_AUTH_URL` | lokalde ✔ | `http://localhost:3000` |
| `REGISTRATION_CODE` | | Doluysa kayıt olurken istenir. Uygulama internete açık olduğu için önerilir |
| `TMDB_API_KEY` | | Yoksa film/dizi araması kapanır, elle ekleme çalışır |
| `GOOGLE_BOOKS_API_KEY` | | Anahtarsız da çalışır ama paylaşımlı kota çabuk dolar (HTTP 429) |

Gizli anahtar üretmek için:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Ardından:

```bash
npm run db:migrate   # tabloları ve başlangıç verisini (medya türleri, varsayılan akış) oluşturur
npm run dev          # http://localhost:3000
```

Hesap aç → grup kur → davet bağlantısını arkadaşına gönder → "Yeni ortak liste". Kişisel listeler üst menüdeki "Listelerim"de.

### Lokal veritabanı seçenekleri

- **Neon "dev" branch'i (önerilen, kurulum yok):** Canlıda kullanacağın Neon projesinde ücretsiz bir `dev` branch'i aç ve onun adresini `.env.local`'a koy. Ayrıntılar: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
- **Docker:** `docker run --name claquette-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=claquette -p 5432:5432 -d postgres:17` → `DATABASE_URL="postgres://postgres:postgres@localhost:5432/claquette"`
- **Bilgisayara kurulu PostgreSQL:** Veritabanı **UTF8** olmalı. Windows'taki kurulumlar varsayılan olarak WIN1252 seçebiliyor; emoji ve Türkçe karakterler hata verir. Gerekirse: `CREATE DATABASE claquette ENCODING 'UTF8' TEMPLATE template0;`

## Komutlar

| Komut | Ne yapar |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu (Turbopack) |
| `npm run build` / `npm start` | Üretim derlemesi / sunucusu |
| `npm run typecheck` | Rota tiplerini üretir ve TypeScript kontrolü yapar |
| `npm run lint` | ESLint |
| `npm test` | Vitest birim testleri (tur hesabı, planlama, seçim kuralları, akış ve liste kuralları) |
| `npm run db:generate` | Şema değişikliğinden yeni SQL migration'ı üretir |
| `npm run db:migrate` | Bekleyen migration'ları uygular |
| `npm run db:studio` | Drizzle Studio ile veritabanını tarayıcıda gez |

## Proje yapısı

```text
src/
├─ app/                        # yalnızca rotalar: sayfalar ince, iş modüllerde
│  ├─ (auth)/sign-in, sign-up
│  ├─ (app)/                   # ana sayfa, grup, ortak liste, öge, davet, Listelerim
│  │                           #   (herkese açık kişisel listeler oturumsuz da açılır)
│  └─ api/auth, api/media/search
├─ modules/                    # özellik modülleri (modüler monolit)
│  ├─ auth/                    # Better Auth yapılandırması, oturum (DAL), formlar
│  ├─ groups/                  # grup, üyelik, davet
│  ├─ challenges/              # ortak listeler (kodda "challenge")
│  │  ├─ domain/               # saf mantık: cadence.ts (tur hesabı), plan.ts (planlama), strategies/ (kurallar)
│  │  ├─ rounds.ts, planning.ts, pool.ts   # turları üretme, turlara yerleştirme, havuzdan seçim
│  │  ├─ summaries.ts          # ana sayfa ve grup kartları
│  │  └─ service / queries / actions / components
│  ├─ lists/                   # kişisel listeler, paylaşım
│  ├─ entries/                 # öneriler, ilerleme, puan, not, oy
│  ├─ media/providers/         # TMDB, Google Books, Open Library, iTunes adaptörleri
│  ├─ workflows/               # durum akışları ve kuralları
│  ├─ activity/                # olay günlüğü ve akış
│  └─ home/                    # "sırada ne var" panosu
├─ db/schema/                  # Drizzle şeması (tek gerçek kaynak)
├─ components/ui/              # ortak arayüz bileşenleri
└─ proxy.ts                    # oturumu olmayanı giriş sayfasına yönlendirir
drizzle/                       # üretilmiş SQL migration'ları + başlangıç verisi
docs/                          # mimari, veri modeli, canlıya alma
```

Her modülde aynı katmanlar var: `domain` (saf, test edilen mantık) → `service.ts` (yazma işlemleri) / `queries.ts` (okuma) → `actions.ts` (Server Actions: doğrulama + yetki) → `components/`.

## Genişletme

| İstek | Yapılacak |
| --- | --- |
| Yeni medya türü (ör. çizgi roman) | `media_types` tablosuna bir satır ekle. Elle ekleme hemen çalışır |
| Yeni veri kaynağı (ör. RAWG ile oyun) | `src/modules/media/providers/` altına `MediaProvider` uygulayan bir dosya, `index.ts`'e bir satır |
| Yeni seçim kuralı (ör. "her ay rastgele kura") | `ChallengeStrategy` uygulayan bir dosya, `STRATEGIES` listesine bir satır. Turları elle doldurmaya izin verecekse `planning()` döndürür. Migration gerekmez |
| Yeni durum adımı (ör. "Ertelendi") | Arayüzden grup için yeni akış oluştur (Grup → Durum akışları → Yeni akış) |
| Şema değişikliği | `src/db/schema` düzenle → `npm run db:generate` → `npm run db:migrate` |

## Notlar

- `npm install` sonrası görülen `npm audit` uyarıları geliştirme araçlarından geliyor (drizzle-kit'in eski esbuild'i, eslint-config-next'in glob bağımlılığı). Üretim paketine girmezler. `npm audit fix --force` drizzle-kit'i çok eski bir sürüme düşürür, çalıştırma.
- TMDB verilerini kullanan uygulamalar atıf göstermek zorunda; atıf alt bilgide (footer) yer alıyor.

## Lisans ve atıflar

Kod [MIT lisansı](LICENSE) ile açık. Bu lisans yalnızca bu depodaki kodu kapsıyor.

Veri kaynakları (TMDB, Google Books, Open Library, Apple), onların logoları ve içerikleri, yazı tipi ve bağımlılıklar
kendi koşullarına tabi. Ayrıntılar [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) dosyasında.

This product uses the TMDB API but is not endorsed or certified by TMDB.
