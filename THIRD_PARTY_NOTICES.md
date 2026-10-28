# Üçüncü taraf bildirimleri

Claquette'in kaynak kodu MIT lisanslıdır (bkz. [LICENSE](LICENSE)). Bu lisans yalnızca bu depodaki kodu kapsar. Aşağıdaki
servisler, markalar, içerikler ve bağımlılıklar kendi koşullarına tabidir.

Depoda hiçbir API anahtarı yoktur. Uygulamanın kendi kopyasını çalıştıran kişi anahtarları kendisi alır ve servislerin
koşullarını kendisi kabul eder.

Claquette bu servislerin hiçbiriyle bağlantılı değildir ve onlar tarafından onaylanmamıştır.

## Veri kaynakları

### TMDB (The Movie Database)

Film ve dizi bilgileri, özetler ve afişler buradan gelir.

> This product uses the TMDB API but is not endorsed or certified by TMDB.

- Bu cümle ve TMDB logosu uygulamanın "Hakkında" sayfasında (`/about`) ve her sayfanın alt bilgisinde gösterilir.
- `public/attribution/tmdb.svg` TMDB'nin logosudur ve TMDB'ye aittir. TMDB'nin
  [logo ve atıf kurallarına](https://www.themoviedb.org/about/logos-attribution) göre kullanılır.
- Koşullar: [TMDB API Terms of Use](https://www.themoviedb.org/api-terms-of-use). Ücretsiz API anahtarı ticari olmayan
  kullanım içindir; ticari kullanım için TMDB'den ayrıca lisans almak gerekir.

### Google Books

Kitap bilgileri ve kapakları buradan gelir.

- Koşullar: [Google APIs Terms of Service](https://developers.google.com/terms) ve
  [Google Books APIs Terms of Service](https://developers.google.com/books/terms).
- `public/attribution/powered-by-google.png` Google'ın markasıdır ve yalnızca atıf için kullanılır.
- Google Books'tan gelen her kitap, Google Books'taki sayfasına bağlanır.

### Open Library

Kitap bilgileri ve kapakları, Internet Archive'ın açık kütüphanesinden gelir.

- Koşullar: [Open Library API](https://openlibrary.org/developers/api).

### Apple iTunes Search API

Podcast bilgileri ve kapakları buradan gelir.

- Koşullar: [Search API](https://performance-partners.apple.com/search-api).
- Apple Podcasts, Apple Inc.'in ticari markasıdır.
- Her podcast, Apple Podcasts'taki sayfasına bağlanır.

### İçerik

Afiş, kapak, özet ve açıklamaların hakları sahiplerine aittir. Uygulama görselleri kendi sunucusunda barındırmaz; tarayıcı
onları doğrudan servislerin sunucularından yükler. Elle eklenen içerik ve görsel adresleri kullanıcılardan gelir.

## Yazı tipi

[Geist](https://github.com/vercel/geist-font) (Vercel), SIL Open Font License 1.1 ile lisanslıdır. Yazı tipi `next/font/google`
ile derleme sırasında indirilir; depoda yazı tipi dosyası yoktur.

## Açık kaynak bağımlılıklar

Üretim bağımlılıkları doğrudan ve dolaylı olarak 114 paketten oluşur. Hiçbiri GPL ya da AGPL lisanslı değildir.

| Lisans | Paket sayısı |
| --- | --- |
| MIT | 93 |
| Apache-2.0 | 9 |
| ISC | 3 |
| BSD-3-Clause | 2 |
| MPL-2.0 | 2 |
| Apache-2.0 AND LGPL-3.0-or-later | 2 |
| Unlicense | 1 |
| 0BSD | 1 |
| CC-BY-4.0 | 1 |

MIT dışındaki kayda değer lisanslar:

- **sharp / libvips (LGPL-3.0-or-later):** Next.js'in görsel işleme için isteğe bağlı kurduğu, önceden derlenmiş bir
  kütüphanedir. Depoda yer almaz. `npm install` ile kurulur ve değiştirilmeden, dinamik olarak kullanılır.
- **lightningcss (MPL-2.0):** Test araç zincirinden (Vite) gelen bir CSS aracıdır. Değiştirilmeden kullanılır ve tarayıcıya
  gönderilen koda girmez.
- **caniuse-lite (CC-BY-4.0):** Tarayıcı destek verisidir ve derleme sırasında kullanılır. Veri, Alexis Deveria'nın
  [Can I use](https://caniuse.com) projesine dayanır.

Her paketin lisans metni, `npm install` sonrasında `node_modules/<paket>/` altındaki LICENSE dosyasındadır.

Listede drizzle-kit, Vitest ve esbuild gibi geliştirme araçları da var: better-auth bunları isteğe bağlı eş bağımlılık
(optional peer) olarak bildirdiği için npm onları üretim ağacında sayar. Bu araçlar yayınlanan uygulamaya girmez.

<details>
<summary>Bütün üretim bağımlılıkları (114 paket, 2026-10-28 itibarıyla <code>package-lock.json</code>'daki sürümler)</summary>

| Paket | Sürüm | Lisans |
| --- | --- | --- |
| @better-auth/core | 1.7.10 | MIT |
| @better-auth/drizzle-adapter | 1.7.10 | MIT |
| @better-auth/kysely-adapter | 1.7.10 | MIT |
| @better-auth/memory-adapter | 1.7.10 | MIT |
| @better-auth/mongo-adapter | 1.7.10 | MIT |
| @better-auth/prisma-adapter | 1.7.10 | MIT |
| @better-auth/telemetry | 1.7.10 | MIT |
| @better-auth/utils | 0.5.0 | MIT |
| @better-fetch/fetch | 1.3.2 | MIT |
| @dnd-kit/accessibility | 3.1.1 | MIT |
| @dnd-kit/core | 6.3.1 | MIT |
| @dnd-kit/sortable | 10.0.0 | MIT |
| @dnd-kit/utilities | 3.2.2 | MIT |
| @drizzle-team/brocli | 0.10.2 | Apache-2.0 |
| @emnapi/core | 1.10.0 | MIT |
| @emnapi/runtime | 1.11.3 | MIT |
| @emnapi/wasi-threads | 1.2.1 | MIT |
| @esbuild-kit/core-utils | 3.3.2 | MIT |
| @esbuild-kit/esm-loader | 2.6.5 | MIT |
| @esbuild/win32-x64 | 0.25.12 | MIT |
| @esbuild/win32-x64 | 0.28.2 | MIT |
| @esbuild/win32-x64 | 0.18.20 | MIT |
| @img/colour | 1.1.0 | MIT |
| @img/sharp-wasm32 | 0.35.5 | Apache-2.0 AND LGPL-3.0-or-later AND MIT |
| @img/sharp-win32-x64 | 0.35.5 | Apache-2.0 AND LGPL-3.0-or-later |
| @jridgewell/resolve-uri | 3.1.2 | MIT |
| @jridgewell/sourcemap-codec | 1.6.0 | MIT |
| @jridgewell/trace-mapping | 0.3.31 | MIT |
| @napi-rs/wasm-runtime | 1.2.5 | MIT |
| @next/env | 16.4.2 | MIT |
| @next/swc-win32-x64-msvc | 16.4.2 | MIT |
| @noble/ciphers | 2.4.0 | MIT |
| @noble/hashes | 2.4.0 | MIT |
| @opentelemetry/semantic-conventions | 1.43.0 | Apache-2.0 |
| @oxc-project/types | 0.154.0 | MIT |
| @rolldown/binding-win32-x64-msvc | 1.2.14 | MIT |
| @rolldown/pluginutils | 1.0.1 | MIT |
| @standard-schema/spec | 1.1.0 | MIT |
| @swc/helpers | 0.5.23 | Apache-2.0 |
| @tybys/wasm-util | 0.10.4 | MIT |
| @types/chai | 5.2.3 | MIT |
| @types/deep-eql | 4.0.2 | MIT |
| @types/estree | 1.0.9 | MIT |
| @types/node | 22.20.5 | MIT |
| @types/react | 19.3.0 | MIT |
| @vitest/mocker | 5.0.5 | MIT |
| @vitest/spy | 5.0.5 | MIT |
| assertion-error | 2.0.1 | MIT |
| baseline-browser-mapping | 2.11.29 | Apache-2.0 |
| better-auth | 1.7.10 | MIT |
| better-call | 1.4.2 | MIT |
| buffer-from | 1.1.2 | MIT |
| caniuse-lite | 1.0.30001816 | CC-BY-4.0 |
| chai | 6.3.0 | MIT |
| class-variance-authority | 0.7.1 | Apache-2.0 |
| client-only | 0.0.1 | MIT |
| clsx | 2.1.1 | MIT |
| csstype | 3.2.3 | MIT |
| date-fns | 4.4.0 | MIT |
| defu | 6.1.7 | MIT |
| detect-libc | 2.1.2 | Apache-2.0 |
| drizzle-kit | 0.31.11 | MIT |
| drizzle-orm | 0.45.4 | Apache-2.0 |
| es-module-lexer | 2.3.2 | MIT |
| esbuild | 0.25.12 | MIT |
| esbuild | 0.28.2 | MIT |
| esbuild | 0.18.20 | MIT |
| estree-walker | 3.0.3 | MIT |
| expect-type | 1.4.0 | Apache-2.0 |
| fdir | 6.5.0 | MIT |
| fflate | 0.8.3 | MIT |
| get-tsconfig | 4.14.3 | MIT |
| jiti | 2.7.0 | MIT |
| jose | 6.2.12 | MIT |
| kysely | 0.29.6 | MIT |
| lightningcss | 1.33.0 | MPL-2.0 |
| lightningcss-win32-x64-msvc | 1.33.0 | MPL-2.0 |
| lucide-react | 1.58.0 | ISC |
| magic-string | 1.4.3 | MIT |
| nanoid | 3.3.20 | MIT |
| nanostores | 1.5.5 | MIT |
| next | 16.4.2 | MIT |
| obug | 3.0.0 | MIT |
| picocolors | 1.1.1 | ISC |
| picomatch | 4.0.7 | MIT |
| postcss | 8.5.23 | MIT |
| postcss | 8.5.30 | MIT |
| postgres | 3.4.9 | Unlicense |
| react | 19.3.0 | MIT |
| react-dom | 19.3.0 | MIT |
| resolve-pkg-maps | 1.0.0 | MIT |
| rolldown | 1.2.14 | MIT |
| rou3 | 0.9.2 | MIT |
| scheduler | 0.28.0 | MIT |
| semver | 7.8.5 | ISC |
| server-only | 0.0.1 | MIT |
| set-cookie-parser | 3.1.3 | MIT |
| sharp | 0.35.5 | Apache-2.0 |
| source-map | 0.6.1 | BSD-3-Clause |
| source-map-js | 1.2.2 | BSD-3-Clause |
| source-map-support | 0.5.21 | MIT |
| std-env | 4.3.0 | MIT |
| styled-jsx | 5.1.6 | MIT |
| tailwind-merge | 3.7.0 | MIT |
| tinybench | 6.2.2 | MIT |
| tinyexec | 1.3.1 | MIT |
| tinyglobby | 0.2.17 | MIT |
| tslib | 2.8.1 | 0BSD |
| tsx | 4.23.15 | MIT |
| undici-types | 6.21.0 | MIT |
| vite | 8.3.4 | MIT |
| vitest | 5.0.5 | MIT |
| why-is-node-running | 3.2.1 | MIT |
| zod | 4.6.7 | MIT |

</details>
