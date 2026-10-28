# ADR 0001: Mimari — Next.js 16 App Router; Vercel'de çalışır ama kilitlenmez

Durum: Kabul edildi
Tarih: 2026-10-28

## Bağlam

Site 2023'te Next.js 15.0.2 Pages Router, React 18, ayrı bir Express sunucusu (PM2 ile), MySQL ve JSON dosya veritabanlarıyla yazılmıştı. Hedefim herkese açık, iki dilli, admin panelli ve demosu Vercel Hobby planında yayında olan bir açık kaynak proje ([revizyon planı](../plans/2026-10-27-revizyon.md) §1, §2). [Vizyon](../vision.md) ilkelerimden biri "Vercel'de çalışır ama Vercel'e kilitlenmez".

Ön taramada admin sayfalarının yalnız middleware ile korunduğunu ve kullanılan sürümün CVE-2025-29927'den etkilendiğini buldum (plan §8, G-04). Bu açık 15.2.3'te kapandı; 16.x hiç etkilenmiyor. Ama ders kalıcı: yetki kontrolü ağ katmanına bırakılmaz.

Doğruladığım gerçekler ([araştırma kaydı](../research/2026-10-28-teknoloji-dogrulamasi.md), bölüm 1, 2, 7, 8):

- Next.js'in en güncel kararlı sürümü 16.4.3; 16.x Active LTS, 15.x Maintenance LTS.
- React'in en güncel kararlı sürümü 19.3.1; Next.js 16.4 React 19.3 ile geliyor.
- `middleware.ts` yerine `proxy.ts` geldi. `proxy` yalnız Node.js çalışma ortamında çalışıyor, Edge desteklenmiyor.
- İstek API'leri (`cookies`, `headers`, `params`, `searchParams`) yalnız `await` ile kullanılıyor.
- Turbopack, `next dev` ve `next build` için varsayılan. `next lint` kaldırıldı.
- Cache Components isteğe bağlı. 16.4 ile her uygulama için öneriliyor, Next.js 17'de varsayılan olacak.
- Nonce tabanlı CSP'de bütün sayfalar dinamik render edilmeli. Statik optimizasyon ve ISR kapanıyor, HTML CDN'de önbelleğe alınamıyor, Partial Prerendering nonce'la uyumsuz. Geliştirme sunucusunda React'in hata ayıklaması `'unsafe-eval'` istiyor; üretimde gerekmiyor.
- Vercel Hobby yalnız ticari olmayan kişisel kullanım için; "bir ürün veya hizmetin satışının reklamı" ticari sayılıyor. Aylık 4 CPU-saat Active CPU ve 1.000.000 fonksiyon çağrısı dahil.
- 2025-12'den bu yana 16.x'te dört kritik açık kapandı (RSC, `next/og`, `use cache`, Image Optimization). 2026-11-03'te yedi orta önemde açık için planlı bir güvenlik sürümü var.
- Next.js 16.2'den beri Vercel dışı dağıtımlar için kararlı bir Adapter API var.
- Vercel'de Node 24.x varsayılan. Node 24, 2026-10-20'de bakım LTS'ine geçti; desteği 2028-04-30'a kadar sürüyor.

## Seçenekler

| Seçenek | Artıları | Eksileri |
|---|---|---|
| Next.js 16 App Router, React 19; standart web API'leri | Active LTS; sunucu bileşenleri, Server Actions, Metadata API, `sitemap.ts`/`robots.ts`; Vercel'de yapılandırmasız; `next start` ile her Node ortamında çalışır; Vercel dışı için Adapter API | Çok sayıda kırıcı değişiklik (async istek API'leri, `proxy.ts`, `next/image` varsayılanları); sık güvenlik sürümleri yakından izlenmeli |
| Next.js 15 Pages Router'da kalıp yükseltmek | En az kod değişikliği | 15.x yalnız kritik düzeltme alıyor; Express sunucusu ve PM2 Vercel'de çalışmıyor; iki dilli yapı ve sunucu bileşenleri hedefiyle uyumsuz |
| Başka bir React framework'üne geçmek | — | Bütün kodun yeniden yazımı; araştırmadım, plan kapsamında değil |

CSP için:

| Seçenek | Artıları | Eksileri |
|---|---|---|
| Bütün sayfalarda nonce tabanlı CSP (`'strict-dynamic'`) | Script için `'unsafe-inline'` yok; bütün sayfalarda tek ve sıkı politika; Next.js nonce'u kendi script'lerine otomatik ekliyor | Bütün sayfalar dinamik; HTML için CDN önbelleği yok; Cache Components/Partial Prerendering kullanılamaz; daha fazla fonksiyon CPU'su |
| Deneysel SRI (hash tabanlı CSP) | Sayfalar statik kalabilir | Deneysel; değişebilir veya kalkabilir; dinamik üretilen script'leri karşılamaz |
| `'unsafe-inline'` ile statik CSP (`next.config` başlıkları) | Basit, statik kalır | G-10'u kapatmaz |

## Karar

Plan §2 ve §5'teki kararı olduğu gibi kaydediyorum: **Next.js 16 App Router ve React 19.** Çalışma ortamı Node 24, paket yöneticisi pnpm (tek kilit dosyası), TypeScript strict. Repo araçları dahil bütün kod TypeScript, düz JavaScript yok (plan §2, D5); Node 24 araç betiklerini derleme adımı olmadan çalıştırdığı için orada yalnız silinebilir TypeScript sözdizimi kullanılır.

Uyacağım kurallar:

1. **Sürüm tabanı:** `next` en az 16.4.3, `react` ve `react-dom` en az 19.3.1. Faz 3'teki uygulama iskeleti PR'ı 2026-11-03 güvenlik sürümünü bekler ya da hemen ardından onu alır. Sürümler kilit dosyasında tam sabit; yükseltmeyi Dependabot önerir.
2. **Rotalar:** `src/app/[locale]/(site)/…` herkese açık sayfalar, `src/app/[locale]/(admin)/dashboard/…` admin, `src/app/api/…` route handler'lar.
3. **`proxy.ts` yalnız iki iş yapar:** dil yönlendirmesi ([ADR 0006](0006-cok-dillilik-next-intl.md)) ve güvenlik başlıkları (CSP nonce dahil). **Yetki kontrolü her sayfada, her Server Action'da ve her route handler'da ayrıca yapılır**, proxy'ye güvenilmez (G-04). Proxy'de iyimser bir oturum çerezi yönlendirmesi olabilir; güvenlik sağladığı varsayılmaz.
4. **Async istek API'leri:** `params`, `searchParams`, `cookies()`, `headers()` her yerde `await` ile kullanılır. Tipler `next typegen` ile üretilen `PageProps`/`LayoutProps`/`RouteContext` ile yazılır.
5. **Turbopack:** varsayılan paketleyici. Özel `webpack` ayarı eklenmez.
6. **Lint:** `next lint` yok. ESLint CLI ve flat config kullanılır ([ADR 0008](0008-ci-ve-koruma-katmanlari.md)).
7. **Kilitlenmeme kuralları:**
   - `@vercel/*` paketleri yalnız `src/server` altındaki küçük adaptörlerde kullanılır (depolama, coğrafi konum başlıkları). Uygulama kodu bu arayüzlere bağlıdır.
   - Edge çalışma ortamı kullanılmaz; her şey Node.js'te çalışır.
   - `pnpm build && pnpm start` yerelde Docker'daki Postgres'le, Vercel olmadan çalışmalıdır.
   - Vercel'e özgü istek başlıkları (`x-vercel-ip-*`) tek bir modülde okunur. Başlık yoksa değer boş kalır, hata verilmez.
   - Ortam değişkenleri standart adlarla (`DATABASE_URL` vb.) ve açılışta zod ile doğrulanır.
8. **Görseller:** `next/image` için uzak kaynaklar `images.remotePatterns` ile yalnız Blob alan adına daraltılır. `sharp` en az 0.35.5 olur.
9. **CSP: baştan bütün sayfalarda nonce tabanlı.**
   - `proxy.ts` her istekte yeni bir nonce üretir.
   - Script kuralı `script-src 'self' 'nonce-…' 'strict-dynamic'`. Script için `'unsafe-inline'` yok; SRI (hash tabanlı CSP) denemesi yok.
   - `'unsafe-eval'` yalnız `NODE_ENV=development` iken eklenir, çünkü Next.js dokümanına göre React'in geliştirme hata ayıklaması onu istiyor. Üretimde yok.
   - Diğer başlıklar plan §5'teki gibi: HSTS, `frame-ancestors 'none'`, `Referrer-Policy`, `Permissions-Policy`.
   - Partial Prerendering nonce'la uyumsuz olduğu için Cache Components açılmaz.

## Sonuçlar

- Olumlu: Express, PM2, `pages/` ve `geoip-lite` yeni koda hiç girmez. Tek bir Next.js uygulaması var. Güvenlik yamaları LTS hattında gelir.
- Olumlu: Yetki kontrolü proxy'den bağımsız olduğu için middleware/proxy atlatma türü açıklar (G-04 sınıfı) tek başına yetkisiz erişim sağlamaz.
- Olumsuz: Eski Pages Router kodu taşınmıyor; uygulama yeni repoda baştan yazılıyor (Faz 3–7).
- **Kabul ettiğim maliyet — nonce'lu CSP.**
  - Bütün sayfalar dinamik render edilir; statik üretim ve ISR yok, HTML için CDN önbelleği yok.
  - Her sayfa isteği bir fonksiyon çalıştırır.
  - Next.js'in önerdiği Cache Components modelini kullanmıyorum; Next.js 17'de varsayılan olunca bu konuyu yeniden ele alırım.
  - Hobby'nin aylık 4 CPU-saat Active CPU ve 1.000.000 çağrı kotasına karşı CPU kullanımını Vercel panelinden izlerim.

  Karşılığında script için `'unsafe-inline'` olmadan, bütün sayfalarda aynı sıkı politika geçerli olur (G-10).
- **Risk — Hobby koşulları.** Hobby yalnız ticari olmayan kişisel kullanıma izin veriyor ve bir ürünün satışının reklamını ticari sayıyor. Demo sitesi kurgusal bir markanın kataloğu. Demo bandı markanın kurgusal olduğunu ve hiçbir şeyin satışta olmadığını açıkça söyler.
- Olumsuz: Next.js'e yaklaşık ayda bir güvenlik sürümü geliyor. Dependabot güvenlik güncellemeleri ve `pnpm audit` kapısı bunun için zorunlu.
- Takip: Node 26 Vercel'de varsayılan olduğunda `.node-version` ve CI yükseltilir. Node 24 desteği 2028-04-30'a kadar sürdüğü için acil değil.
- Testler: her korumalı sayfa ve handler için "oturum yok", "oturum var ama yetki yok" ve "demo modunda yazma" durumları entegrasyon testinde sınanır ([ADR 0007](0007-test-stratejisi.md)).

## Kaynaklar

- [Araştırma kaydı](../research/2026-10-28-teknoloji-dogrulamasi.md), bölüm 1, 2, 7, 8
- https://nextjs.org/blog/next-16
- https://nextjs.org/docs/app/guides/upgrading/version-16
- https://nextjs.org/blog/next-16-4
- https://nextjs.org/support-policy
- https://github.com/vercel/next.js/releases
- https://github.com/vercel/next.js/security/advisories/GHSA-f82v-jwr5-mffw
- https://nextjs.org/blog/nextjs-security-update-october-14-2026
- https://nextjs.org/blog/upcoming-nextjs-security-release-november-2026
- https://nextjs.org/docs/app/guides/content-security-policy
- https://github.com/facebook/react/releases
- https://vercel.com/docs/plans/hobby
- https://vercel.com/docs/limits/fair-use-guidelines
- https://vercel.com/docs/functions/runtimes/node-js/node-js-versions
- https://nodejs.org/docs/latest-v24.x/api/typescript.html
