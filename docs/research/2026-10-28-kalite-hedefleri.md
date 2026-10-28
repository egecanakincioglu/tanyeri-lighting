# Kalite hedefleri: ölçüm araçları ve kanıtlar

Tarih: 2026-10-28 · Kapsam: SEO, yapay zekâ aramasında görünürlük (GEO), erişilebilirlik, performans, ajan erişimi ve duyarlı tasarım için "tam puan"ın ölçülebilir tanımı · İlgili karar: [ADR 0009](../adr/0009-kalite-hedefleri.md) · Önceki araştırma: [teknoloji doğrulaması](2026-10-28-teknoloji-dogrulamasi.md)

ADR 0009'u yazmadan önce her katmanda neyin gerçekten ölçülebildiğini ve neyin yalnız iddia olduğunu birincil kaynaklardan kontrol ettim: sürüm notları, aracın kaynak kodu, resmi dokümanlar, standart metinleri ve npm kayıt defteri. Ayrıca kendi makinemde küçük bir Next.js 16 sayfasıyla ölçtüm (bölüm 9). Durum değerleri önceki araştırmamla aynı:

- **Doğrulandı:** kaynağı kendim okudum ya da komutu kendim çalıştırdım.
- **Doğrulanmadı:** kaynakta açıkça yazmıyor, çıkarım yaptım ya da kontrol edemedim.

Sürümler 2026-10-28 itibarıyla; npm sürümlerini ve yayın tarihlerini `npm view` ile kendim sorguladım.

## Özet: kararı etkileyen bulgular

1. **Lighthouse 13.6.0'da deneysel bir "Agentic Browsing" kategorisi var.** 0–100 puan değil, geçen denetim oranı gösteriyor. `llms.txt`, ARD ve WebMCP denetimleri ilgili dosya ya da API yoksa "uygulanamaz"; bugün puanı belirleyen yalnız erişilebilirlik ağacı ve CLS.
2. **Lighthouse'un erişilebilirlik kategorisi WCAG 2.2 AA'nın tamamı değil.** axe'i yalnız `wcag2a` ve `wcag2aa` etiketleriyle ve bazı kuralları kapalı çalıştırıyor. Tam kapsam için axe ayrıca çalışmalı.
3. **Lighthouse CI eski.** Son sürümü 0.15.1 (2025-06) ve Lighthouse 12.6.1'e sabit.
4. **Google yapay zekâ özellikleri için ayrı bir optimizasyon istemiyor.** `llms.txt` kullanmıyor; yapılandırılmış veri yapay zekâ özellikleri için zorunlu değil.
5. **Büyük yapay zekâ tarayıcılarının çoğu JavaScript çalıştırmıyor.** İçerik ham HTML'de olmalı.
6. **Denememde metin LCP'li sayfa mobilde 100, görsel LCP'li sayfa 98–99 aldı.** Next.js 16 + React 19 + next-intl tabanının JavaScript aktarımı 150 KB.
7. **Nonce'lu `style-src`, `next/image`'ın satır içi stilini engelliyor.** Düzen bozuldu, yatay taşma oldu; Lighthouse'un performans, erişilebilirlik ve SEO puanı 100 kaldı, axe bir şey bulmadı.
8. **JSON-LD `dangerouslySetInnerHTML` olmadan yazılabiliyor.** React 19.3'ün sunucu render'ı `<script>` metin çocuğundaki `<script` ve `</script` dizilerini kaçırıyor; HTML standardına göre veri blokları CSP denetimine girmiyor.


## Bu bulgular üzerine verdiğim kararlar (2026-10-28)

Ayrıntıları [ADR 0009](../adr/0009-kalite-hedefleri.md)'da:

- Ölçüm CI'da, yerel üretim derlemesine karşı: Lighthouse 13.6, axe-core 4.14 ve puppeteer-core 25; yeni zorunlu iş `site-audit` (`pages`, `mobile`, `desktop`). Lighthouse CI'ı ve uçtan uca test çatısını kullanmıyorum.
- Lighthouse'un dört kategorisi mobilde ve masaüstünde kesin 100. Görsel LCP'li sayfanın mobilde 98–99 aldığını gördüğüm için mobilde ilk ekran metinle açılıyor: ana sayfada LCP öğesi değer önermesi olan `h1`, görseller ikincil.
- `style-src 'self' 'unsafe-inline'`; script kuralı nonce'lu ve `'unsafe-inline'`'sız kalıyor.
- Üretim dizine giriyor, önizlemeler girmiyor; robots bütün tarayıcılara aynı kuralı veriyor, hiçbirini adıyla anmıyor; `llms.txt` yok.
- JSON-LD tek bileşende, `<script>` metin çocuğu olarak ve kendi `<` kaçışımla; `dangerouslySetInnerHTML` yasağı istisnasız kalıyor (S-09).
- ADR 0007'nin tarayıcı kararı daraldı: sayfa denetimleri gerçek Chrome'da ve tek bir işlevsel senaryo (JavaScript'siz iletişim formu).

## 1. Lighthouse 13.6

| İddia | Durum | Kaynak |
|---|---|---|
| Son sürüm 13.6.0 (2026-10-27); 13.0.0 2025-10-10'da çıktı; Node >= 22.19 istiyor; Apache-2.0 | Doğrulandı | https://registry.npmjs.org/lighthouse/13.6.0 |
| Bağımlılıkları arasında `axe-core` 4.14.0 ve `puppeteer-core` ^25.16.0 var | Doğrulandı | https://registry.npmjs.org/lighthouse/13.6.0 |
| Varsayılan yapılandırmada beş kategori: `performance`, `accessibility`, `best-practices`, `seo`, `agentic-browsing` | Doğrulandı | https://github.com/GoogleChrome/lighthouse/blob/v13.6.0/core/config/default-config.js |
| Performans ağırlıkları: FCP 10, LCP 25, TBT 30, CLS 25, SI 10; INP 0 | Doğrulandı | aynı dosya |
| Mobil benzetim 412×823, DPR 1,75; masaüstü 1350×940, DPR 1 | Doğrulandı | https://github.com/GoogleChrome/lighthouse/blob/v13.6.0/core/config/constants.js |
| Metrik puanı log-normal eğriden; 0,9'un üstüne küçük bir artış eklenip iki basamağa aşağı yuvarlanıyor; kategori puanı ağırlıklı ortalamanın iki basamağa yuvarlanmışı | Doğrulandı | https://github.com/GoogleChrome/lighthouse/blob/v13.6.0/shared/util.js · https://github.com/GoogleChrome/lighthouse/blob/v13.6.0/core/scoring.js |
| Bu formülle metrik puanını 1,00 yapan üst sınırlar. Mobil: FCP 1067 ms, SI 1953 ms, LCP 1545 ms, TBT 64 ms, CLS 0,039. Masaüstü: FCP 538 ms, SI 737 ms, LCP 590 ms, TBT 63 ms. Mobil LCP 1792 ms'de 0,99, 2206 ms'de 0,95; TBT'nin 0,99 sınırı mobilde 91 ms, masaüstünde 82 ms. Diğer dört ölçü 1,00 iken tek bir ölçünün 0,98 olması kategori puanını 100'de tutuyor, yalnız TBT'nin 0,98 olması 99'a düşürüyor; denememdeki görsel LCP'nin puanı 0,96–0,97'ydi (kendi hesabım) | Doğrulandı (formülü kendim hesapladım) | metrik dosyalarındaki p10 ve medyan değerleri: https://github.com/GoogleChrome/lighthouse/tree/v13.6.0/core/audits/metrics |
| Erişilebilirlik kategorisi axe'i `runOnly: wcag2a, wcag2aa` ile çalıştırıyor; `nested-interactive`, `scrollable-region-focusable`, `role-img-alt`, `aria-tab-name`, `frame-title-unique`, `duplicate-id` gibi kurallar kapalı; `target-size` (wcag22aa) ve `autocomplete-valid` açık | Doğrulandı | https://github.com/GoogleChrome/lighthouse/blob/v13.6.0/core/gather/gatherers/accessibility.js |
| En iyi uygulamalarda puanlanan denetimler arasında `errors-in-console`, `inspector-issues`, `deprecations`, `third-party-cookies`, `image-aspect-ratio`, `image-size-responsive`, `paste-preventing-inputs` var; `csp-xss`, `has-hsts`, `trusted-types-xss`, `valid-source-maps` bilgi amaçlı (ağırlık 0) | Doğrulandı | default-config.js |
| SEO denetimleri: `is-crawlable` (ağırlığı tek başına kategoriyi düşürecek kadar yüksek), `document-title`, `meta-description`, `http-status-code`, `link-text`, `crawlable-anchors`, `robots-txt`, `image-alt`, `hreflang`, `canonical`; `structured-data` elle (ağırlık 0) | Doğrulandı | default-config.js |
| `canonical` denetimi başka bir hreflang adresini gösteren ya da her sayfadan kök adrese giden kanoniği hata sayıyor; başka bir alan adını göstermesini tek başına hata saymıyor | Doğrulandı | https://github.com/GoogleChrome/lighthouse/blob/v13.6.0/core/audits/seo/canonical.js |
| 13.0.2 `robots-txt` denetimine `Content-Signal` yönergesini, 13.6.0 `License` yönergesini ekledi | Doğrulandı | https://github.com/GoogleChrome/lighthouse/releases |
| Değişkenlik: "5 koşunun medyanı tek koşudan iki kat kararlı"; paylaşımlı ya da patlamalı makinelerden kaçınılması, aynı makinede eşzamanlı koşu yapılmaması öneriliyor | Doğrulandı | https://github.com/GoogleChrome/lighthouse/blob/main/docs/variability.md |

## 2. Lighthouse CI ve diğer araçlar

| İddia | Durum | Kaynak |
|---|---|---|
| `@lhci/cli` son sürümü 0.15.1 (2025-06-25); `lighthouse` 12.6.1'e sabit bağımlı; Lighthouse 13 sürümü yok | Doğrulandı | https://registry.npmjs.org/@lhci/cli/0.15.1 |
| `axe-core` son sürümü 4.14.0 (2026-10-05); lisansı MPL-2.0 | Doğrulandı | https://registry.npmjs.org/axe-core/4.14.0 |
| `puppeteer-core` son sürümü 25.16.0 (2026-10-22); Node >= 22.12; Apache-2.0 | Doğrulandı | https://registry.npmjs.org/puppeteer-core/25.16.0 |
| `schema-dts` son sürümü 2.1.0 (2026-10-02); Apache-2.0; Next.js'in JSON-LD rehberi tipleme için öneriyor | Doğrulandı | https://registry.npmjs.org/schema-dts/2.1.0 · https://nextjs.org/docs/app/guides/json-ld |
| GitHub'ın Ubuntu 24.04 imajında (20261023) Google Chrome 155 kurulu | Doğrulandı | https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md |
| Otomatik test (axe-core) erişilebilirlik sorunlarının hacimce yaklaşık %57'sini buluyor; satıcı kaynaklı bir çalışma | Doğrulandı | https://accessibility.deque.com/hubfs/Accessibility-Coverage-Report.pdf |
| Google'ın Zengin Sonuçlar Testi'nin ve Schema Markup Validator'ın CI'da kullanılabilecek resmi bir API'si | Doğrulanmadı (bulamadım) | https://search.google.com/test/rich-results · https://validator.schema.org/ |

## 3. SEO: Google'ın kuralları

| İddia | Durum | Kaynak |
|---|---|---|
| hreflang'da her dil sürümü kendini ve diğerlerini listelemeli; karşılıklı olmayan etiketler yok sayılıyor; adresler tam (şemalı) olmalı | Doğrulandı | https://developers.google.com/search/docs/specialty/international/localized-versions |
| `x-default` hiçbir dil eşleşmediğinde kullanılıyor ve dil seçici sayfaları için tasarlanmış | Doğrulandı | aynı sayfa |
| HTML, HTTP başlığı ve sitemap yöntemleri Google için eşdeğer; üçünü birlikte kullanmanın aramada faydası yok | Doğrulandı | aynı sayfa |
| Google tahmin edilen dile göre otomatik yönlendirmeden kaçınmayı öneriyor; Googlebot `Accept-Language` göndermiyor ve çoğunlukla ABD'den tarıyor; her sayfada diğer dillere bağlantı öneriliyor | Doğrulandı | https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites |
| Google `lastmod`'u yalnız tutarlı ve doğrulanabilir biçimde doğruysa kullanıyor; `priority` ve `changefreq`'i yok sayıyor | Doğrulandı | https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap |
| `Organization`'ın zorunlu alanı yok; ana sayfaya ya da kurumu anlatan tek bir sayfaya konması öneriliyor; `contactPoint` destekleniyor; yerel bir işletme için `LocalBusiness` alt türü ve yerel işletme kuralları geçerli | Doğrulandı | https://developers.google.com/search/docs/appearance/structured-data/organization |
| Ürün parçacığı için `name` ve `review`, `aggregateRating` ya da `offers`'tan biri zorunlu; `Offer` için `price` zorunlu | Doğrulandı | https://developers.google.com/search/docs/appearance/structured-data/product-snippet |
| Bunlar olmadan `Product` işaretlemesinin Search Console'da hangi önem derecesiyle raporlandığı | Doğrulanmadı | — |
| next-intl'in proxy'si varsayılan olarak `Link` başlığıyla hreflang veriyor; `x-default` öneksiz yolu gösteriyor ve 307 ile en uygun dile yönlendiriyor; `alternateLinks: false` ile kapanıyor; dil çerezi oturum çerezi ve yalnız tarayıcının diliyle uyuşmayan bir dil seçilince yazılıyor | Doğrulandı | https://next-intl.dev/docs/routing/configuration |
| `sitemap.ts` dil alternatiflerini (`alternates.languages`) 14.2'den beri destekliyor; istek zamanı bir API kullanmadıkça önbelleğe alınıyor | Doğrulandı | https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap |

## 4. GEO: yapay zekâ aramasında görünürlük

| İddia | Durum | Kaynak |
|---|---|---|
| Google'ın 2026 rehberi: üretken yapay zekâ özellikleri Arama'nın sıralama ve kalite sistemlerine dayanıyor; bu iş "hâlâ SEO"; görünmek için sayfanın dizinde ve snippet'le gösterilebilir olması gerekiyor | Doğrulandı (sayfa 2026-07-10 güncellemesi) | https://developers.google.com/search/docs/fundamentals/ai-optimization-guide |
| Aynı rehber: `llms.txt` gibi yeni dosyalar gerekmiyor, Google Arama kullanmıyor; içeriği küçük parçalara bölmek gerekmiyor; yapılandırılmış veri yapay zekâ özellikleri için zorunlu değil, zengin sonuçlar için öneriliyor; üçüncü taraf "GEO" araçlarının Google'ın sistemlerine erişimi yok | Doğrulandı | aynı sayfa |
| Aynı rehber: ölçüm için Search Console'un üretken yapay zekâ performans raporu var; tarayıcı ajanları ekran görüntüsünü, DOM'u ve erişilebilirlik ağacını okuyabiliyor | Doğrulandı | aynı sayfa |
| Yapay zekâ özelliklerinde görünmek için ek gereksinim ve özel schema.org işaretlemesi yok; sayfanın dizinde ve snippet için uygun olması yetiyor; gösterilen bilgiyi `nosnippet`, `data-nosnippet`, `max-snippet` ve `noindex` sınırlıyor | Doğrulandı (sayfa 2025-12-10 güncellemesi) | https://developers.google.com/search/docs/appearance/ai-features |
| Vercel'in ağındaki analiz (2024-12): büyük yapay zekâ tarayıcılarının çoğu JavaScript çalıştırmıyor; JavaScript dosyalarını indirenler de çalıştırmıyor; Google'ın altyapısını kullanan ve Apple'ın tarayıcısı render ediyor; yapay zekâ tarayıcılarının isteklerinin yaklaşık üçte biri 404'e düşüyor; öneri: ana içeriği sunucuda render etmek, sitemap'i güncel ve yönlendirmeleri temiz tutmak | Doğrulandı (veri 2024 tarihli) | https://vercel.com/blog/the-rise-of-the-ai-crawler |
| `llms.txt` bir topluluk önerisi; Lighthouse'un `llms-txt` denetimi dosya 404 ise "uygulanamaz", 5xx ya da 429 ise başarısız sayıyor; Chrome dokümanı dosyayı "şimdilik isteğe bağlı" diyor | Doğrulandı | https://llmstxt.org/ · https://github.com/GoogleChrome/lighthouse/blob/v13.6.0/core/audits/agentic/llms-txt.js · https://developer.chrome.com/docs/lighthouse/agentic-browsing/llms-txt |
| Bir yapay zekâ arama motorunun `llms.txt`'i kaynak seçiminde kullandığına dair birincil kaynak | Doğrulanmadı (bulamadım) | — |
| Yapay zekâ kullanım tercihlerini robots.txt'ye ve HTTP başlığına bağlayan IETF çalışması (aipref) hâlâ taslak: `draft-ietf-aipref-attach-05` (2026-08), RFC değil | Doğrulandı | https://datatracker.ietf.org/doc/draft-ietf-aipref-attach/ · https://www.ietf.org/archive/id/draft-ietf-aipref-attach-05.html |
| Taslak dışı `Content-Signal` yönergesine tarayıcıların uyduğu | Doğrulanmadı | — |
| GEO üzerine akademik çalışmalar (kaynak, alıntı ve sayı eklemenin görünürlüğü artırdığı) | Doğrulanmadı (birincil kaynağı bu araştırmada okumadım; kararımda kullanmadım) | — |

## 5. Ajan erişimi

| İddia | Durum | Kaynak |
|---|---|---|
| Lighthouse'un "Agentic Browsing" kategorisi 13.2–13.3'te eklendi; 13.6'da denetimleri `agent-accessibility-tree`, `webmcp-form-coverage`, `webmcp-registered-tools`, `webmcp-schema-validity`, `cumulative-layout-shift`, `llms-txt`, `ard-schema`; puan gösterimi `fraction` | Doğrulandı | https://github.com/GoogleChrome/lighthouse/blob/v13.6.0/core/config/default-config.js · https://github.com/GoogleChrome/lighthouse/releases |
| Kategori deneysel, "geliştiriliyor ve değişebilir"; 0–100 ağırlıklı puanı yok, geçen denetim oranı gösteriyor; Chrome 150 ve üstü gerekiyor | Doğrulandı | https://developer.chrome.com/docs/lighthouse/agentic-browsing/scoring |
| `agent-accessibility-tree` axe sonuçlarından ad, etiket ve ARIA ile ilgili kuralların bir alt kümesine bakıyor (ör. `button-name`, `label`, `link-name`, `aria-*`, `autocomplete-valid`) | Doğrulandı | https://github.com/GoogleChrome/lighthouse/blob/v13.6.0/core/audits/agentic/agent-accessibility-tree.js |
| WebMCP denetimleri tarayıcı API'yi desteklemiyorsa ya da sayfada form yoksa "uygulanamaz"; `webmcp-form-coverage` bilgi amaçlı; ARD denetimi `/.well-known/ard.json` 4xx ve başka sinyal yoksa "uygulanamaz" | Doğrulandı | https://github.com/GoogleChrome/lighthouse/tree/v13.6.0/core/audits |
| WebMCP önerilen bir web standardı; Chrome 149'dan itibaren kaynak denemesi (origin trial); `tools` izin politikasıyla korunuyor (varsayılan `self`); API değişebilir | Doğrulandı (sayfa 2026-10-07 güncellemesi) | https://developer.chrome.com/docs/ai/webmcp |
| ARD bir taslak spesifikasyon (Lighthouse 13.6 sürüm 0.91'i denetliyor) | Doğrulandı | https://agenticresourcediscovery.org/spec/ · https://github.com/GoogleChrome/lighthouse/releases |
| web.dev'in ajan dostu site önerileri: etkileşimli öğelerin üstünde saydam örtü yok; `div` yerine `button` ve `a`; etiketler `for` ile bağlı; eylem öğeleri görünür ve yeterince büyük; düzen kararlı; erişilebilirlik ağacının denetimi | Doğrulandı (sayfa 2026-04-01 güncellemesi) | https://web.dev/articles/ai-agent-site-ux |
| Chrome ekibinin "ajan hazır" araç seti (2026-06-22): Lighthouse'un ajan kategorisi Chrome M150'den itibaren; puanlar "bilgi amaçlı ve kıyaslanmamış" | Doğrulandı | https://developer.chrome.com/blog/agent-ready-toolkit |

## 6. Duyarlı tasarım ve WCAG 2.2

| İddia | Durum | Kaynak |
|---|---|---|
| StatCounter, 2026-09, dünya, mobil: 414×896 %13,35; 360×800 %7,54; 384×832 %7,1; 390×844 %6,05; 393×873 %4,18 | Doğrulandı | https://gs.statcounter.com/screen-resolution-stats/mobile/worldwide |
| StatCounter, 2026-09, Türkiye, mobil: 414×896 %4,64; 393×873 %3,02; 384×832 %2,80; 360×800 %2,35; 390×844 %1,93 | Doğrulandı | https://gs.statcounter.com/screen-resolution-stats/mobile/turkey |
| StatCounter, 2026-09, dünya, tablet: 768×1024 %8,09; 800×1280 %7,86; 1280×800 %7,85; 820×1180 %5,06 | Doğrulandı | https://gs.statcounter.com/screen-resolution-stats/tablet/worldwide |
| StatCounter, 2026-09, dünya, masaüstü: 1920×1080 %28,07; 1536×864 %10; 1366×768 %7,95; 1280×720 %4,71; 2560×1440 %3,95 | Doğrulandı | https://gs.statcounter.com/screen-resolution-stats/desktop/worldwide |
| StatCounter değerlerinin CSS pikseli olduğu | Doğrulanmadı (sayfa belirtmiyor; mobil değerlerin CSS pikseline denk geldiğini varsaydım) | — |
| WCAG 2.2: 1.4.10 Yeniden akış (320 CSS px genişlikte iki boyutlu kaydırma yok), 1.4.4 Metni yeniden boyutlandırma (%200), 1.3.4 Yönelim, 1.4.12 Metin aralığı, 1.4.13 Üzerine gelince ya da odakta açılan içerik, 2.5.8 Hedef boyutu (en az 24×24 CSS px, AA), 2.4.11 Odak gizlenmemeli (AA), 2.5.7 Sürükleme hareketleri (AA), 3.3.8 Erişilebilir kimlik doğrulama (AA) | Doğrulandı | https://www.w3.org/TR/WCAG22/ |
| Tailwind 4'te `hover` varyantı `@media (hover: hover) { &:hover }` olarak üretiliyor | Doğrulandı | https://tailwindcss.com/docs/hover-focus-and-other-states |
| Tailwind'de `h-screen` `100vh`; `h-dvh`, `h-svh`, `h-lvh` dinamik, küçük ve büyük görünüm birimleri | Doğrulandı | https://tailwindcss.com/docs/height |
| Google'ın yapay zekâ rehberi sayfa deneyimi için "her cihazda iyi görünme"yi öneriyor | Doğrulandı | https://developers.google.com/search/docs/fundamentals/ai-optimization-guide |

## 7. Platform: Vercel ve Neon

| İddia | Durum | Kaynak |
|---|---|---|
| Vercel önizleme dağıtımlarına ve eskimiş üretim dağıtımlarına varsayılan olarak `X-Robots-Tag: noindex` ekliyor; güncel üretim alan adında bu başlık yok | Doğrulandı | https://vercel.com/kb/guide/are-vercel-preview-deployment-indexed-by-search-engines |
| "Standard Protection" bütün planlarda var ve üretim alan adları dışındaki her dağıtımı koruyor; parola koruması Hobby'de yok | Doğrulandı (sayfa 2026-09-15 güncellemesi) | https://vercel.com/docs/deployment-protection |
| Hobby'de fonksiyonlar tek bölgede çalışıyor; yeni projelerde varsayılan `iad1`; bölge `vercel.json`'da `regions` ile değişiyor; Vercel fonksiyonu veri kaynağına yakın seçmeyi öneriyor | Doğrulandı (sayfa 2026-08-11 güncellemesi) | https://vercel.com/docs/functions/configuring-functions/region |
| "Bot Protection" ve "AI Bots" yönetilen kural setleri bütün planlarda var ve varsayılan kapalı; AI Bots için "Log" ve "Deny" seçilebiliyor | Doğrulandı (sayfa 2026-09-10 güncellemesi) | https://vercel.com/docs/vercel-firewall/vercel-waf/managed-rulesets |
| Neon'un uykudan uyanması bağlantıya genellikle birkaç yüz milisaniye ekliyor; varsayılan uyku süresi 5 dakika | Doğrulandı | https://neon.com/docs/connect/connection-latency |

## 8. Next.js, React ve HTML

| İddia | Durum | Kaynak |
|---|---|---|
| Next.js JSON-LD'yi `layout` ya da `page` içinde yerel bir `<script>` öğesiyle öneriyor; örneği `dangerouslySetInnerHTML` ve `<` karakterinin unicode karşılığına çevrilmesiyle; `next/script` yerine yerel `<script>`; `schema-dts` ile tipleme; doğrulama için Zengin Sonuçlar Testi ve Schema Markup Validator | Doğrulandı (sayfa 2026-03-02 güncellemesi) | https://nextjs.org/docs/app/guides/json-ld |
| React 19.3.1'in sunucu render'ı `<script>` öğesinin metin çocuğunda `<script` ve `</script` dizilerini (büyük-küçük harf duyarsız) `\u0073` kaçışıyla bozuyor; `dangerouslySetInnerHTML`'e dokunmuyor | Doğrulandı (react-dom 19.3.1'in `pushScriptImpl` kodunu okudum ve `renderToString` ile denedim) | https://registry.npmjs.org/react-dom/19.3.1 |
| React'in istemci tarafı, veri bloğu olan `<script>` için "script çalıştırılmaz" uyarısını vermiyor (`isScriptDataBlock`) | Doğrulandı (react-dom 19.3.1 geliştirme derlemesi) | aynı paket |
| React dokümanı satır içi script'in çocuğunu "dizgi" olarak tanımlıyor; kaçış davranışını belgelemiyor | Doğrulandı | https://react.dev/reference/react-dom/components/script |
| HTML standardı: türü JavaScript ya da modül olmayan bir `script` öğesi veri bloğu; "script öğesini hazırla" algoritması 13. adımda döner, CSP denetimi 21. adımda; yani veri blokları CSP'ye hiç girmiyor | Doğrulandı | https://html.spec.whatwg.org/multipage/scripting.html#prepare-the-script-element |
| `unstable_cache` Next.js 16'da yerini `use cache`'e bıraktı; Next.js Cache Components'e geçip onu kullanmayı öneriyor | Doğrulandı (sayfa 2026-09-01 güncellemesi) | https://nextjs.org/docs/app/api-reference/functions/unstable_cache |
| `after` 15.1'den beri kararlı; yanıt gönderildikten sonra çalışıyor; Vercel'de `waitUntil` ile | Doğrulandı | https://nextjs.org/docs/app/api-reference/functions/after |
| Next.js 16.4'te `next/image`'ın `priority` özelliği kullanımdan kalktı, yerine `preload`; `preload` görsel ön yükleme bağlantısı ekliyor ama `fetchpriority="high"` eklemiyor | Doğrulandı (next 16.4.3 tip tanımları ve ürettiği HTML) | https://registry.npmjs.org/next/16.4.3 |
| Next.js 16.4.3'ün `next build` çıktısında rota başına boyut sütunları yok | Doğrulandı (çalıştırdım) | — |

## 9. Denemem: Next.js 16 sayfasında Lighthouse 13.6

Ortam: kendi makinem (Windows 11, Chrome 156, Lighthouse'un ölçtüğü `benchmarkIndex` 3200–4200), Node 24.21. Uygulama: Next.js 16.4.3 (Turbopack), React 19.3.1, next-intl 4.14.9; `/tr` ve `/en` önekli; tek bir proxy'de next-intl ve nonce'lu CSP (`script-src 'self' 'nonce-…' 'strict-dynamic'`); bir istemci bileşeni (menü düğmesi); `next build` ve `next start`, yerel adres. Her ölçüm üç koşu; benzetimli kısıtlama (varsayılan).

| Durum | Mobil (perf / a11y / BP / SEO) | Masaüstü | Not |
|---|---|---|---|
| A. `style-src` nonce'lu; LCP görseli `next/image` | 100 / 100 / 88 / 100 | 100 / 100 / 92 / 100 | Satır içi `style` niteliği CSP'ye takıldı: konsol hatası; görsel 1600 px'te kaldı; 320–1440 px'te yatay taşma. axe (WCAG 2.2 AA ve `best-practice`) ihlal bulmadı. LCP öğesi metin oldu; FCP ve LCP 0,76–0,79 s, TBT 32–45 ms |
| B. `style-src 'self' 'unsafe-inline'`; favicon eklendi | 99 / 100 / 100 / 100 | 100 / 100 / 100 / 100 | Taşma kalmadı. LCP öğesi görsel (750w, 6 KB): LCP 2,04–2,05 s (puan 0,96–0,97) |
| C. B'ye ek olarak `fetchPriority="high"` | 99 / 100 / 100 / 100 | — | LCP keşif önerisi geçti; LCP 2,06–2,13 s değişmedi. Lantern benzetimi JavaScript aktarımını LCP'ye katıyor |
| D. `next/image` yerine düz `<img>` | 98–99 | — | Aynı sonuç: fark bileşenden değil, 150 KB JavaScript'le paylaşılan bant genişliğinden. TBT bir koşuda 94 ms (değişkenlik) |
| E. JSON-LD, `<script>` metin çocuğu, `</script><script>` içeren ad | BP 100, SEO 100 | — | HTML'de kaçırılmış; tarayıcıda `JSON.parse` aynı değeri verdi; konsol hatası yok |

Ortak ölçümler:
- JavaScript aktarımı 150 KB (7 istek); belge 4 KB; CSS 1 KB.
- "Agentic Browsing": `agent-accessibility-tree` ve CLS geçti; WebMCP, `llms-txt` ve `ard-schema` uygulanamaz; oran tam.
- Taşma ve axe denetimi 9 genişlikte (320–1920) tek sayfa için 7,7 s sürdü. axe sayfanın CSP'sine rağmen DevTools protokolüyle enjekte edilebildi.
- next-intl'in proxy'si nonce'lu CSP'yle aynı fonksiyonda çalıştı: istek başlığına yazılan nonce Next.js'in bütün script'lerine uygulandı; `Link` başlığında `x-default` `/`'u gösterdi; kök `/` 307 ile `/en`'e yönlendi (`Accept-Language: en-US`).

Sonuçlarım:
- Metin LCP'li sayfada nonce'lu CSP ve dinamik render'a rağmen mobil 100 alınabiliyor.
- Görsel LCP'li sayfada mobil 98–99. 100 için ya JavaScript aktarımını küçültmek ya da mobilde ilk ekranın en büyük öğesini metin yapmak gerekiyor.
- Kapıyı Lighthouse puanlarına bırakmak yetmiyor; konsol ve taşma denetimi şart.
- Bu sonuçlar benim makinemde; GitHub'ın çalıştırıcısında Faz 3'te yeniden ölçeceğim.

## Doğrulanmamış kalanlar

- GitHub'ın çalıştırıcısında aynı sayfanın puanları ve koşular arası değişkenlik; çalıştırıcıdaki Chrome 155'te Lighthouse 13.6'nın ajan kategorisinin aynı sonucu verdiği.
- Ubuntu 24.04 çalıştırıcısında Chrome'un sandbox'la başlayıp başlamadığı.
- `site-audit` kollarının süresi.
- Zengin Sonuçlar Testi ve Schema Markup Validator için resmi bir API.
- `Product` işaretlemesi `offers`, `review` ya da `aggregateRating` olmadan kullanılırsa Search Console'daki önem derecesi.
- StatCounter çözünürlüklerinin CSS pikseli olduğu.
- Bir yapay zekâ arama motorunun `llms.txt`'i kullandığı; `Content-Signal` ve aipref tercihlerine uyulduğu.
- Vercel'in fonksiyon soğuk başlangıcının Hobby'deki tipik süresi.
