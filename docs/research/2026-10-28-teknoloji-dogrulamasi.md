# Teknoloji doğrulaması

Tarih: 2026-10-28 · Kapsam: [revizyon planı](../plans/2026-10-27-revizyon.md) §2 ve §5'teki teknoloji kararları · İlgili kararlar: [adr/](../adr/README.md)

ADR'leri yazmadan önce planımdaki teknoloji kararlarını birincil kaynaklardan tek tek kontrol ettim: sürüm notları, resmi dokümanlar, GitHub sürümleri ve güvenlik bildirimleri, npm kayıt defteri. Her iddianın yanına durumunu yazdım:

- **Doğrulandı:** kaynağı kendim okudum ya da komutu kendim çalıştırdım; kaynak bağlantısı yanında.
- **Doğrulanmadı:** kaynakta açıkça yazmıyor, çıkarım yaptım ya da kontrol edemedim.

Sürüm numaraları 2026-10-28 itibarıyla. npm etiketlerini `npm view <paket> dist-tags` ve `npm view <paket>@<sürüm> peerDependencies engines` ile kendim sorguladım; kaynak olarak kayıt defterinin adresini yazdım. Sürüm tahmini yapmadım; bulamadığımı "doğrulanmadı" diye bıraktım.

## Özet: planı etkileyen bulgular

1. **Prisma sürümü.** `prisma` paketinin npm'deki `latest` etiketi bir sürüm adayını gösteriyor (`8.0.0-rc.28`); `@prisma/client` ise `7.10.1`'de. Prisma 8 baştan yazılmış bir sürüm: CLI'ı `schema.prisma` okumuyor, `migrate dev` ve `db push` yok. Better Auth yalnız Prisma 5–7'yi destekliyor. "Postgres + Prisma" kararım duruyor; bütün Prisma paketlerini 7.10.x'e tam sürümle sabitledim.
2. **Better Auth artık Vercel bünyesinde:** Vercel, Better Auth'u 2026-07-07'de satın aldı. Lisans MIT, çerçeveden bağımsız ve her yerde çalışıyor; "Vercel'de çalışır ama kilitlenmez" ilkesine teknik olarak aykırı değil, ama yönetişim riski olarak kaydettim.
3. **Better Auth varsayılanları planla örtüşmüyor:** rate limit varsayılanı bellekte ve geliştirmede kapalı; şifre sıfırlamada diğer oturumlar varsayılan olarak düşmüyor; sunucu tarafı `auth.api` çağrıları rate limit'e takılmıyor. Hepsi ayarla çözülüyor; giriş ve sıfırlama formları doğrudan `/api/auth/*` handler'ına gitmeli.
4. **Nonce tabanlı CSP (plan §5) bütün sayfaları dinamik render'a zorluyor:** statik üretim, ISR, CDN önbelleği ve Partial Prerendering kapanıyor. Next.js 16.4 Cache Components'i her uygulama için öneriyor, Next.js 17'de varsayılan olacak. Hobby planında aylık 4 CPU-saat Active CPU var.
5. **Semgrep CE:** `p/nextjs` hesapsız istemcide boş geliyor (0 kural), `p/react` yalnız 4 kural. Semgrep'in kural lisansı kullanımı "kendi iç iş amaçlarına" sınırlıyor; herkese açık bir projenin CI'ında kullanım açıkça ele alınmamış.
6. **Action kısıtı (plan §4):** gitleaks-action ve pnpm/action-setup "doğrulanmış yayıncı" değil. gitleaks-action v2'den beri MIT değil, özel bir son kullanıcı sözleşmesiyle geliyor.
7. **Dosya yükleme:** Vercel Functions'ta istek gövdesi sınırı 4,5 MB. Sunucuda sharp ile yeniden kodlama planım bu sınırın altındaki dosyalarla çalışır.
8. **Neon önizleme dalları:** Free planda proje başına 10 dal var. Vercel entegrasyonu her önizleme dağıtımına bir dal açıyor ve dallar Vercel'in saklama süresine (varsayılan 6 ay) bağlı siliniyor; sınır dolabilir.
9. **Vercel Hobby:** yalnız ticari olmayan kişisel kullanım. "Bir ürün veya hizmetin satışının reklamı" ticari sayılıyor; kurgusal katalog demosunun bu tanıma girmediğini açıkça yazan bir kaynak bulamadım.
10. **Test boşluğu:** Next.js dokümanı Vitest'in async Server Component'leri desteklemediğini ve onlar için uçtan uca test önerdiğini yazıyor. Tarayıcı test aracı kullanmama kararım bu boşluğu bilerek kabul ediyor.
11. **Node:** Node 24, 2026-10-20'de bakım LTS'ine geçti (destek 2028-04-30'a kadar); Node 26 bugün aktif LTS oluyor. Vercel dokümanında 24.x varsayılan, 26 listede yok.
12. **Yaklaşan güvenlik sürümü:** 2026-11-03'te yedi orta önemde açığı kapatacak planlı bir Next.js güvenlik sürümü var; Faz 4'teki bağımlılık PR'ı en az o sürümü hedefliyor ([ADR 0001](../adr/0001-mimari-nextjs-16-app-router.md)).

## Bu bulgular üzerine verdiğim kararlar (2026-10-28)

Bulguları değerlendirdikten sonra aynı gün şu kararları verdim; ayrıntıları ADR'lerde:

| Bulgu | Karar | ADR |
|---|---|---|
| 1. Prisma sürümü | Bütün Prisma paketleri 7.10.x'e tam sabit; sürücü adaptörü `@prisma/adapter-pg`, Neon'a havuzlu TCP ile | [0002](../adr/0002-veri-ve-depolama.md) |
| 2, 3. Better Auth | Better Auth kabul: yalnız çekirdek e-posta/şifre, Prisma adaptörü, eklenti yok. Zorunlu ayarlar: `disableSignUp`, `revokeSessionsOnPasswordReset`, `revokeOtherSessions`, `rateLimit` `storage: "database"` ve `enabled: true`. Giriş ve sıfırlama `/api/auth/*` üzerinden. Vercel'in satın alması bir risk olarak kayıtlı | [0003](../adr/0003-kimlik-dogrulama.md), [0004](../adr/0004-rate-limit.md) |
| 4. Nonce'lu CSP | Baştan bütün sayfalarda nonce tabanlı CSP (`'strict-dynamic'`); SRI denemesi yok; script için `'unsafe-inline'` yok. Bütün sayfaların dinamik render edilmesini ve HTML için CDN önbelleği olmamasını kabul ettim; Hobby'de CPU kullanımını izliyorum | [0001](../adr/0001-mimari-nextjs-16-app-router.md) |
| 5. Semgrep | CodeQL (`security-extended`) ana SAST tarayıcısı. Semgrep yalnız projeye özel kurallarla çalışıyor; registry setleri yok (lisans belirsizliği ve ince CE kapsamı) | [0008](../adr/0008-ci-ve-koruma-katmanlari.md) |
| 6. Action kısıtı | gitleaks sağlama toplamı doğrulanmış ikili dosya olarak, pnpm Corepack ile kuruluyor | [0008](../adr/0008-ci-ve-koruma-katmanlari.md) |
| 7. Dosya yükleme | Yalnız sunucudan, en fazla 4 MB; sihirli baytlarla tür kontrolü, sharp ile yeniden kodlama ve meta veri temizliği, sonra Vercel Blob; istemciden doğrudan yükleme yok | [0002](../adr/0002-veri-ve-depolama.md) |
| 8. Neon önizleme dalları | Bütün PR önizlemeleri için üretimden ayrı tek, paylaşılan bir Neon önizleme veritabanı; önizleme başına dal yok | [0002](../adr/0002-veri-ve-depolama.md) |
| 9. Hobby koşulları | Demo bandı markanın kurgusal olduğunu ve hiçbir şeyin satışta olmadığını söylüyor | [0001](../adr/0001-mimari-nextjs-16-app-router.md) |
| 10. Test boşluğu | Tarayıcı test aracı yok; kabul edilmiş boşluk. Async Server Component'ler ince, bütün mantık test edilebilir sunucu modüllerinde; render'ı görsel kontrol karşılıyor | [0007](../adr/0007-test-stratejisi.md) |
| — Dil yapısı | `/tr` ve `/en` her zaman önekli (`localePrefix: "always"`), varsayılan `tr`; kök `/` `Accept-Language`'a göre yönlendiriliyor | [0006](../adr/0006-cok-dillilik-next-intl.md) |

## 1. Next.js 16

Neyi kontrol ettim: GitHub sürümleri, npm etiketleri, Next.js 16 duyurusu ve yükseltme rehberi, 16.4 duyurusu, destek politikası, güvenlik bildirimleri ve CSP rehberi.

| İddia | Durum | Kaynak |
|---|---|---|
| En güncel kararlı sürüm 16.4.3 (2026-10-23); `canary` 16.5.0-canary.29; 15.x için `backport` 15.5.28 | Doğrulandı | https://github.com/vercel/next.js/releases · https://registry.npmjs.org/-/package/next/dist-tags |
| 16.x Active LTS, 15.x Maintenance LTS; her ana sürüm ilk yayından itibaren iki yıl bakım alır; 15'in bakım süresi uzatıldı | Doğrulandı | https://nextjs.org/support-policy |
| `next@16.4.3` Node `>=20.9.0` istiyor; React peer `^18.2.0 \|\| ^19.0.0` | Doğrulandı | https://registry.npmjs.org/next/16.4.3 |
| `middleware.ts` yerine `proxy.ts`; dışa aktarılan fonksiyon `proxy`; `proxy` yalnız Node.js çalışma ortamında, Edge desteklenmiyor ve ayarlanamıyor; `middleware.ts` Edge için duruyor ama kullanımdan kalkıyor | Doğrulandı | https://nextjs.org/blog/next-16 · https://nextjs.org/docs/app/guides/upgrading/version-16 |
| `middleware` adlı ayarlar yeniden adlandırıldı (ör. `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`) | Doğrulandı | https://nextjs.org/docs/app/guides/upgrading/version-16 |
| `cookies()`, `headers()`, `draftMode()`, `params`, `searchParams` için senkron erişim tamamen kalktı; yalnız `await` ile; `npx next typegen` `PageProps`, `LayoutProps`, `RouteContext` tiplerini üretiyor | Doğrulandı | https://nextjs.org/docs/app/guides/upgrading/version-16 |
| Önbellek: Cache Components (`cacheComponents: true`) tamamen isteğe bağlı; açık değilken dinamik kod istek anında çalışır; `revalidateTag` ikinci argüman (cacheLife profili) istiyor; `updateTag` ve `refresh` yeni | Doğrulandı | https://nextjs.org/blog/next-16 |
| 16.4 ile Cache Components her uygulama için öneriliyor, yeni projelerde varsayılan açık; Next.js 17'de varsayılan model olacak | Doğrulandı | https://nextjs.org/blog/next-16-4 |
| Turbopack `next dev` ve `next build` için varsayılan; özel `webpack` ayarı varsa `next build` hata verir; `--webpack` ile çıkılır | Doğrulandı | https://nextjs.org/docs/app/guides/upgrading/version-16 |
| `next lint` kaldırıldı; `next build` artık lint çalıştırmıyor; config'deki `eslint` seçeneği kalktı; `@next/eslint-plugin-next` flat config varsayılanlı; `eslint-config-next@16.4.0+` ESLint 10'u destekliyor (ESLint `latest` 10.13.0) | Doğrulandı | https://nextjs.org/docs/app/guides/upgrading/version-16 · https://registry.npmjs.org/-/package/eslint/dist-tags |
| `next/image` varsayılanları değişti: `qualities` yalnız `[75]`, `minimumCacheTTL` 4 saat, yerel IP optimizasyonu kapalı, en fazla 3 yönlendirme, sorgu dizgili yerel kaynaklar `localPatterns` istiyor | Doğrulandı | https://nextjs.org/docs/app/guides/upgrading/version-16 |
| Paralel rota slotları açık `default.js` istiyor; AMP, `serverRuntimeConfig`/`publicRuntimeConfig` kalktı | Doğrulandı | https://nextjs.org/blog/next-16 |
| 16.2'de kararlı bir Adapter API ve herkese açık adaptör test paketi geldi (Vercel dışı dağıtım için) | Doğrulandı (yalnız blog dizinindeki özet) | https://nextjs.org/blog |
| Nonce tabanlı CSP için bütün sayfalar dinamik render edilmeli; statik optimizasyon ve ISR kapanır, CDN önbelleği olmaz, Partial Prerendering nonce'la uyumsuz; alternatif olarak deneysel SRI (hash tabanlı) var | Doğrulandı | https://nextjs.org/docs/app/guides/content-security-policy |

### CVE-2025-29927 ve sonraki kritik bildirimler

| Bildirim | Önem | Etkilenen / düzelten sürüm | Durum | Kaynak |
|---|---|---|---|---|
| CVE-2025-29927 / GHSA-f82v-jwr5-mffw — middleware ile yetki atlatma | Kritik (CVSS 9.1) | Etkilenen: 11.1.4–<12.3.5, 13.0.0–<13.5.9, 14.0–<14.2.25, 15.0–<15.2.3. Düzelten: 12.3.5, 13.5.9, 14.2.25, 15.2.3. 16.x etkilenen aralıkta değil. Eski sitedeki 15.0.2 etkileniyor (G-04 doğru) | Doğrulandı | https://github.com/vercel/next.js/security/advisories/GHSA-f82v-jwr5-mffw |
| CVE-2025-66478 — React Server Components protokolünde uzaktan kod çalıştırma | Kritik (CVSS 10.0) | 15.x ve 16.x App Router; 16.x için düzelten 16.0.7 | Doğrulandı | https://nextjs.org/blog/CVE-2025-66478 |
| 2025-12-11 — RSC'de hizmet engelleme ve kaynak kod sızması (iki ek açık) | — | Ayrıntısını okumadım | Doğrulanmadı | https://react.dev/blog · https://nextjs.org/blog |
| GHSA-vcvr-r3jv-pc5j — Node.js `ImageResponse` (`next/og`) ile uzaktan kod çalıştırma | Kritik | >=16.2.0 <16.3.6; düzelten 16.3.6 | Doğrulandı | https://nextjs.org/blog/nextjs-security-update-september-22-2026 |
| GHSA-cjq9-62q9-8jv4 — Image Optimization'da SSRF (yalnız `images.remotePatterns` tanımlıysa) | Yüksek | Düzelten 16.3.8 | Doğrulandı | https://nextjs.org/blog/september-2026-security-release |
| GHSA-673q-mjm6-r5xr — typed array döndüren `use cache` fonksiyonlarında kimliksiz uzaktan kod çalıştırma | Kritik | Düzelten 16.4.1 | Doğrulandı | https://nextjs.org/blog/nextjs-security-update-october-14-2026 |
| CVE-2026-96889 / GHSA-2464-fhr4-w9xw — SVG ile Image Optimization'da uzaktan kod çalıştırma (glibc Linux, sharp kaynaklı) | Kritik | Düzelten 16.4.1; geçici çözüm sharp >= 0.35.5 (sharp `latest` 0.35.5) | Doğrulandı | https://nextjs.org/blog/nextjs-security-update-october-14-2026 · https://registry.npmjs.org/-/package/sharp/dist-tags |
| GHSA-p3m5-59mp-jv5r — Server Actions ile hizmet engelleme | Yüksek | Düzelten 16.4.1 | Doğrulandı | https://nextjs.org/blog/nextjs-security-update-october-14-2026 |
| 2026-11-03 planlı güvenlik sürümü: yedi orta önemde açık | Orta | Sürümler henüz yayında değil | Doğrulandı (duyuru) | https://nextjs.org/blog/upcoming-nextjs-security-release-november-2026 |

Doğrulanmamış kalanlar:
- Güvenlik bildirimleri sayfası 8 sayfa; yalnız ilk sayfayı okudum. Daha eski sayfalarda başka kritik veya yüksek bildirim olabilir.
- 16.4.3'ün bütün bu düzeltmeleri içerdiğini sürüm sırasından çıkarıyorum (16.4.3 > 16.4.1 > 16.3.8); her birini sürüm notunda tek tek görmedim.

## 2. React 19

Neyi kontrol ettim: GitHub sürümleri, npm etiketleri, react.dev blogu.

| İddia | Durum | Kaynak |
|---|---|---|
| En güncel kararlı sürüm 19.3.1 (2026-10-14); 19.3.0 2026-09-09'da çıktı; aynı gün 19.2.9, 19.1.10, 19.0.9 da yayımlandı | Doğrulandı | https://github.com/facebook/react/releases · https://registry.npmjs.org/-/package/react/dist-tags |
| Next.js 16.4, React 19.3 ile geliyor | Doğrulandı | https://nextjs.org/blog/next-16-4 |
| React Server Components'te 2025-12-03'te kritik uzaktan kod çalıştırma açığı (CVE-2025-55182) duyuruldu; 19.0.1, 19.1.2, 19.2.1'de düzeldi | Doğrulandı | https://react.dev/blog |

Doğrulanmamış kalanlar:
- 2026-10-14'teki eş zamanlı yama sürümlerinin güvenlik amaçlı olduğu (sürüm notları "security" demiyor; aynı gün Next.js'in güvenlik güncellemesi çıktı).
- PDF görüntüleyici ve sayfa çevirme bileşeninin React 19.3 uyumu (plan E-05); Faz 4–5'te denenecek.

## 3. Kimlik doğrulama

### 3.1 Better Auth

Neyi kontrol ettim: GitHub sürümleri ve güvenlik bildirimlerinin dört sayfası, npm etiketleri ve peer bağımlılıkları, Next.js entegrasyonu, Prisma adaptörü, e-posta/şifre, oturum yönetimi, rate limit, güvenlik ve seçenekler referansı; 1.7.14 paketinin rate limit ve Prisma adaptörü kodunu okudum.

| İddia | Durum | Kaynak |
|---|---|---|
| En güncel kararlı sürüm 1.7.14 (2026-10-26); `beta` 1.8.0-beta.3; 1.6 hattı 1.6.33 | Doğrulandı | https://github.com/better-auth/better-auth/releases · https://registry.npmjs.org/-/package/better-auth/dist-tags |
| Peer bağımlılıkları: `next ^14 \|\| ^15 \|\| ^16`, `react ^18 \|\| ^19`, `prisma` ve `@prisma/client ^5 \|\| ^6 \|\| ^7` (Prisma 8 yok) | Doğrulandı | https://registry.npmjs.org/better-auth/1.7.14 · https://registry.npmjs.org/@better-auth/prisma-adapter/1.7.14 |
| Dokümanda "Next.js 16 ile tam uyumlu"; handler `toNextJsHandler(auth)` ile `/api/auth/[...all]`; sunucu bileşeninde `auth.api.getSession({ headers: await headers() })`; `proxy.ts`'te Node çalışma ortamı sayesinde tam oturum doğrulaması yapılabiliyor; `getSessionCookie` yalnız iyimser yönlendirme, güvenli değil | Doğrulandı | https://www.better-auth.com/docs/integrations/next |
| Server Action'larda çerez yazımı için `nextCookies()` eklentisi gerekiyor (eklenti dizisinde en sonda) | Doğrulandı | https://www.better-auth.com/docs/integrations/next |
| Prisma adaptörü: `prismaAdapter(prisma, { provider: "postgresql" })`; dokümandaki örnek Prisma 7 ve `@prisma/adapter-pg` ile; şema `npx auth@latest generate` ile üretiliyor, migration'ı Prisma uyguluyor | Doğrulandı | https://www.better-auth.com/docs/adapters/prisma |
| Şifre hash'i varsayılan olarak scrypt (Node'da yerleşik); özel `hash`/`verify` verilebiliyor; şifre 8–128 karakter | Doğrulandı | https://www.better-auth.com/docs/authentication/email-password · https://www.better-auth.com/docs/reference/security |
| `disableSignUp` (varsayılan `false`), `resetPasswordTokenExpiresIn` (varsayılan 3600 sn), `revokeSessionsOnPasswordReset` (varsayılan `false`; destekleyen adaptörde şifre değişimiyle aynı transaction'da) | Doğrulandı | https://www.better-auth.com/docs/reference/options |
| Şifre sıfırlamada diğer oturumlar varsayılan olarak düşmüyor; `changePassword({ revokeOtherSessions: true })` diğer oturumları düşürüyor; `revokeSession`, `revokeOtherSessions`, `revokeSessions` var | Doğrulandı | https://www.better-auth.com/docs/authentication/email-password · https://www.better-auth.com/docs/concepts/session-management |
| Oturumlar veritabanında; varsayılan ömür 7 gün; çerez önbelleği açılırsa iptal edilen oturum `maxAge` dolana kadar başka cihazda geçerli kalabiliyor | Doğrulandı | https://www.better-auth.com/docs/concepts/session-management · https://www.better-auth.com/docs/reference/security |
| CSRF/origin: güvenilmeyen origin'den gelen istekler reddediliyor; çerezsiz giriş/kayıtta Fetch Metadata ile giriş CSRF'i engelleniyor; çerezler `HttpOnly`, `SameSite=Lax`, https'te `Secure`; yönlendirme adresleri `trustedOrigins`'e karşı denetleniyor | Doğrulandı | https://www.better-auth.com/docs/reference/security |
| `BETTER_AUTH_SECRET` (yoksa `AUTH_SECRET`) üretimde zorunlu; yoksa hata veriyor | Doğrulandı | https://www.better-auth.com/docs/reference/options |
| Rate limit: üretimde varsayılan açık, geliştirmede kapalı; varsayılan 10 sn'de 100 istek; depolama varsayılanı bellek; `storage: "database"` ile `rateLimit` tablosu; yol başına `customRules`; IP varsayılan olarak `x-forwarded-for`'dan; IPv6 /64 alt ağına göre | Doğrulandı | https://www.better-auth.com/docs/concepts/rate-limit · https://www.better-auth.com/docs/reference/options |
| **Sunucu tarafı `auth.api` çağrıları rate limit'e takılmıyor; yalnız istemciden gelen istekler sınırlanıyor** | Doğrulandı | https://www.better-auth.com/docs/concepts/rate-limit |
| Bakım: MIT, 30,5 bin yıldız, 7.826 commit, 404 açık issue, 499 açık PR; Ekim 2026'da 1.7.9'dan 1.7.14'e altı yama sürümü | Doğrulandı | https://github.com/better-auth/better-auth · https://github.com/better-auth/better-auth/releases |
| Vercel, Better Auth'u 2026-07-07'de satın aldı; MIT, isim ve açık katkı modeli sürüyor; "çerçeveden bağımsız, her yerde çalışır"; Vercel dışı platformlar için ayrıca somut bir taahhüt yok | Doğrulandı | https://vercel.com/blog/vercel-acquires-better-auth |
| Güvenlik bildirimleri: dört sayfada toplam 37; çoğu eklentilerde (SSO, SCIM, OAuth sağlayıcı, Stripe, passkey, API anahtarı, cihaz girişi) | Doğrulandı | https://github.com/better-auth/better-auth/security/advisories |
| Çekirdeği ilgilendirenler: trusted origin atlatma (2025-02, yüksek), açık yönlendirmeler (2024-12, 2025-02, 2025-07), tekrar eden eğik çizgiyle kapalı yol ve rate limit atlatma (2025-12, yüksek), IPv6 adres döndürerek rate limit atlatma (2026-05, yüksek), OAuth `state` ile magic link girişi (2026-09, kritik, 1.7.7'de düzeldi) | Doğrulandı (başlık, önem ve tarih) | https://github.com/better-auth/better-auth/security/advisories · https://github.com/better-auth/better-auth/releases/tag/v1.7.7 |
| GHSA-44jh-23m7-hpcf: Postgres'te veritabanı depolamalı rate limiter'da yarış durumu; Drizzle adaptöründe 1.6.17–<1.7.7, Kysely'de 1.6.17+ (1.7.0'da düzeldi); Prisma anılmıyor | Doğrulandı | https://github.com/better-auth/better-auth/security/advisories/GHSA-44jh-23m7-hpcf |

Doğrulanmamış kalanlar:
- 37 bildirimin her birinin 1.7.14'te kapandığını tek tek açıp görmedim; en yeni kritik bildirimin düzeltmesi 1.7.7'de.
- Prisma adaptörünün rate limit sayacı eşzamanlı isteklerde güvenli mi: 1.7.14 kodunu okudum; sayaç `count < max` ve pencere koşullu tek bir `UPDATE` ile, transaction içinde artırılıyor. Bu Postgres'te atomik görünüyor ama belgede yazmıyor; gerçek Postgres'te eşzamanlı bir entegrasyon testiyle doğrulayacağım.
- Çerez önbelleğinin (`session.cookieCache`) varsayılan olarak kapalı olduğu (doküman açmak için ayar gösteriyor; varsayılanı yazmıyor).
- `disableSignUp: true` iken seed betiğinin ilk admini nasıl oluşturacağı (sunucu API'si mi, kütüphanenin hash fonksiyonu mu).
- `disabledPaths` seçeneğinin davranışı (yalnız bir güvenlik bildiriminin başlığında geçiyor); demo modunda şifre değiştirme uçlarını kapatmak için kullanılabilir.
- Varsayılan "özel" rate limit kurallarının hangi yolları ve hangi değerleri kapsadığı.

### 3.2 Auth.js

| İddia | Durum | Kaynak |
|---|---|---|
| Auth.js'in bakımı 2025-09'da Better Auth ekibine geçti; bakım güvenlik ve acil sorunlar için sürüyor; yeni projeler için Better Auth öneriliyor | Doğrulandı | https://github.com/nextauthjs/next-auth/discussions/13252 |
| `next-auth` `latest` 4.24.15; v5 hâlâ beta (`5.0.0-beta.32`); `@auth/prisma-adapter` 2.11.3 | Doğrulandı | https://registry.npmjs.org/-/package/next-auth/dist-tags · https://registry.npmjs.org/-/package/@auth/prisma-adapter/dist-tags |
| Credentials sağlayıcısı varsayılan olarak veritabanına bir şey yazmıyor; şifre hash'i ve rate limit'i uygulamanın yazması gerekiyor; şifre yerine daha modern yöntemler öneriliyor | Doğrulandı | https://authjs.dev/getting-started/authentication/credentials |

Doğrulanmamış kalanlar:
- Credentials sağlayıcısının yalnız JWT oturumlarıyla çalıştığı (sayfada yazmıyor).
- next-auth 4.x / 5 beta'nın Next.js 16 ile resmi uyumu.

### 3.3 Lucia yaklaşımı

| İddia | Durum | Kaynak |
|---|---|---|
| Lucia kütüphanesi Mart 2025'te bırakıldı; site artık tek dosyalık örnek kod ve öğrenme kaynağı sunuyor | Doğrulandı | https://lucia-auth.com/ |
| Bu yol oturum ve token kodunu kendim yazmam demek; plan §2'deki "kendi oturum veya kripto kodumu yazmıyorum" kararıyla çelişiyor | Doğrulandı (plan ile karşılaştırma) | [revizyon planı](../plans/2026-10-27-revizyon.md) |

## 4. Prisma

Neyi kontrol ettim: npm etiketleri ve yayın tarihleri, GitHub sürümleri, sürüm durumu sayfası, Prisma 7 yükseltme rehberi, Vercel'e dağıtım rehberi, Neon rehberi (Neon ve Prisma tarafı), istemci referansındaki veritabanı upsert'leri.

| İddia | Durum | Kaynak |
|---|---|---|
| Prisma 7'nin kararlı son sürümü 7.10.1 (npm'de 2026-10-15); GitHub'da "Latest" 7.10.1 | Doğrulandı | https://github.com/prisma/prisma/releases · https://registry.npmjs.org/-/package/@prisma/client/dist-tags |
| **`prisma` paketinin `latest` etiketi `8.0.0-rc.28` (2026-10-27), `prev` 7.10.1; `@prisma/client`, `@prisma/adapter-neon`, `@prisma/adapter-pg` `latest` 7.10.1** | Doğrulandı | https://registry.npmjs.org/-/package/prisma/dist-tags |
| Prisma 8 bir sürüm adayı; genel kullanıma açılması Ekim 2026'da bekleniyor; CLI'ı `schema.prisma` okumuyor, `generate`, `migrate dev`, `db push` yok; `$extends`, atomik `increment` ve çoğu iç içe yazma henüz yok | Doğrulandı | https://www.prisma.io/docs/orm/release-status |
| Prisma 7 bakım ve güvenlik güncellemelerini Prisma 8'in genel sürümünden sonra 18 ay alacak; Prisma 7 kullananlara `prisma@7` sabitlemesi öneriliyor | Doğrulandı | https://www.prisma.io/docs/orm/release-status |
| Prisma 8 baştan, tamamen TypeScript ile yazılıyor; migration'lar doğrusal listeden grafiğe geçiyor | Doğrulandı | https://www.prisma.io/blog/the-next-evolution-of-prisma-orm |
| Prisma 7: her istemci bir sürücü adaptörü istiyor (`new PrismaClient({ adapter })`); yeni `prisma-client` üreteci ve zorunlu `output` yolu; `prisma.config.ts`; ortam değişkenleri otomatik yüklenmiyor; ESM (`"type": "module"`); `migrate dev` artık seed ve generate çalıştırmıyor; `$use` kalktı | Doğrulandı | https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7 |
| `prisma@7.10.1` Node `^20.19 \|\| ^22.12 \|\| >=24.0` istiyor | Doğrulandı | https://registry.npmjs.org/prisma/7.10.1 |
| Neon ile: çalışma anında havuzlu `DATABASE_URL` (`-pooler`), CLI ve migration için havuzsuz `DATABASE_URL_UNPOOLED` (`prisma.config.ts` içinde); `@prisma/adapter-neon` kendi bağımlılıklarını getiriyor, `@neondatabase/serverless` ayrıca kurulmuyor; üç paket aynı ana sürümde kurulmalı | Doğrulandı | https://neon.com/docs/guides/prisma |
| `@prisma/adapter-neon@7.10.1` `@neondatabase/serverless >0.6.0 <2`'ye bağlı (`latest` 1.2.0) | Doğrulandı | https://registry.npmjs.org/@prisma/adapter-neon/7.10.1 |
| Neon 5 dakika boşta kalınca uyuyor; ilk bağlantıda zaman aşımı için `connect_timeout` önerisi (Prisma'nın Neon sayfası v6 için) | Doğrulandı (v6 sayfası) | https://www.prisma.io/docs/orm/overview/databases/neon |
| Vercel'de: `postinstall`'da `prisma generate`; `vercel-build` örneği `prisma generate && prisma migrate deploy && next build`; önizlemeler için ayrı veritabanı ve yalnız Preview ortamına özel `DATABASE_URL`; Fluid compute'ta `attachDatabasePool` önerisi | Doğrulandı | https://www.prisma.io/docs/orm/prisma-client/deployment/serverless/deploy-to-vercel |
| Postgres'te veritabanı upsert'i (`INSERT ... ON CONFLICT`) yalnız şu koşullarda: iç içe sorgu yok, tek model, `where`'de tek benzersiz alan ve `create`'teki değerle aynı | Doğrulandı | https://www.prisma.io/docs/orm/reference/prisma-client-reference |

Doğrulanmamış kalanlar:
- Prisma 8'in genel sürüm tarihi (sayfa Ekim 2026 diyor; 2026-10-23 itibarıyla hâlâ aday).
- Prisma 7 destek süresi için iki kaynak çelişiyor: eski blog yazısı "12 ay", güncel sürüm durumu sayfası "Prisma 8 genel sürümünden sonra 18 ay". Güncel sayfayı esas aldım.
- `@prisma/adapter-pg` ile Neon'un havuzlu bağlantısının Vercel'de soğuk başlangıç davranışı; Faz 9'da ölçeceğim.

## 5. Neon (Vercel Marketplace üzerinden)

| İddia | Durum | Kaynak |
|---|---|---|
| Vercel Postgres artık yok; Marketplace üzerinden Postgres sağlayıcıları bağlanıyor | Doğrulandı | https://vercel.com/docs/postgres |
| Free plan: 100 proje; proje başına 10 dal; proje başına ayda 100 CU-saat (0,25 CU ile ~400 saat); proje başına 1 GB depolama (hesapta toplam 20 GB); en fazla 2 CU; 5 dakikada uyku (kapatılamıyor); proje başına ayda 5 GB çıkış trafiği; 6 saatlik geri dönüş penceresi; 1 elle snapshot | Doğrulandı | https://neon.com/docs/introduction/plans |
| Sınır aşılırsa: CU-saat veya trafik aşımında compute dönem sonuna kadar askıya alınıyor; depolama aşımında yazma işlemleri başarısız; veri silinmiyor | Doğrulandı | https://neon.com/docs/introduction/plans |
| İki entegrasyon: Vercel tarafından yönetilen (fatura Vercel'den, Neon hesabı otomatik) ve Neon tarafından yönetilen (fatura Neon'dan); ikisinde de önizleme dağıtımı başına otomatik dal | Doğrulandı | https://neon.com/docs/guides/vercel-overview |
| Vercel tarafından yönetilen entegrasyon şu değişkenleri ekliyor: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `PGHOST`, `PGHOST_UNPOOLED`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`, eski `POSTGRES_*` | Doğrulandı | https://neon.com/docs/guides/vercel-managed-integration |
| Önizleme dalları (`preview/<git-dalı>`) Vercel dağıtımı silinince siliniyor; varsayılan saklama 6 ay olduğu için dallar uzun süre kalabiliyor | Doğrulandı | https://neon.com/docs/guides/vercel-managed-integration |
| Marketplace sayfası Free plan sunuyor ("Plans starting at $0") | Doğrulandı | https://vercel.com/marketplace/neon |

Doğrulanmamış kalanlar:
- Önizleme dallarının Free plandaki 10 dal sınırına sayılıp sayılmadığı ve sınır dolunca önizleme dağıtımının ne olacağı. Önizleme başına dal yerine tek, paylaşılan bir önizleme veritabanı kullanmaya karar verdiğim için artık belirleyici değil ([ADR 0002](../adr/0002-veri-ve-depolama.md)).
- Marketplace üzerinden Free planın Hobby hesaplarda kullanılabildiği (sayfa açıkça yazmıyor).

## 6. Vercel Blob (Hobby)

| İddia | Durum | Kaynak |
|---|---|---|
| Hobby'de dahil kullanım: 1 GB depolama, ilk 10.000 basit işlem, ilk 2.000 gelişmiş işlem (yükleme, kopyalama, listeleme, mağaza oluşturma), ilk 10 GB Blob veri aktarımı; Hobby'nin dahil kullanımı projedeki bütün Vercel servisleriyle paylaşılıyor | Doğrulandı | https://vercel.com/docs/vercel-blob/usage-and-pricing |
| Hobby'de sınır aşılırsa ücret çıkmıyor ama Blob 30 gün boyunca kullanılamıyor | Doğrulandı | https://vercel.com/docs/vercel-blob/usage-and-pricing |
| İşlem hızı sınırı Hobby'de dakikada 1.200 basit, 900 gelişmiş; dosya başına en fazla 5 TB; 512 MB üstü dosyalar önbelleğe alınmıyor; silme ücretsiz; panelde gezinmek de gelişmiş işlem sayılıyor | Doğrulandı | https://vercel.com/docs/vercel-blob/usage-and-pricing |
| Vercel Functions'ta istek gövdesi sınırı 4,5 MB; daha büyük dosyalar için istemci yüklemesi öneriliyor | Doğrulandı | https://vercel.com/docs/vercel-blob/server-upload |
| Bağlanan mağaza varsayılan olarak OIDC ile kısa ömürlü kimlik bilgisi kullanıyor (`BLOB_STORE_ID`, `VERCEL_OIDC_TOKEN`); Vercel dışı için `BLOB_READ_WRITE_TOKEN` yedeği; mağazalar `private` veya `public` | Doğrulandı | https://vercel.com/docs/vercel-blob/server-upload |
| `@vercel/blob` `latest` 2.8.2 | Doğrulandı | https://registry.npmjs.org/-/package/@vercel/blob/dist-tags |

## 7. Vercel Hobby koşulları

| İddia | Durum | Kaynak |
|---|---|---|
| Hobby ücretsiz; kişisel projeler ve küçük uygulamalar için; "yalnız ticari olmayan kişisel kullanım" | Doğrulandı | https://vercel.com/docs/plans/hobby · https://vercel.com/docs/limits/fair-use-guidelines |
| Ticari kullanım: üretiminde yer alan herhangi birinin maddi kazancı için kullanılan dağıtım. Örnekler: ziyaretçiden ödeme almak, bir ürün veya hizmetin satışının reklamı, siteyi yapmak veya barındırmak için ödeme almak, temel amacın satış ortaklığı bağlantısı olması, reklam içermesi. Bağış istemek ticari değil; emin olunamazsa destek ekibine sorulması öneriliyor | Doğrulandı | https://vercel.com/docs/limits/fair-use-guidelines |
| Aylık dahil kullanım: 100 GB Fast Data Transfer, 10 GB Fast Origin Transfer, 1.000.000 CDN isteği, 4 CPU-saat Active CPU, 360 GB-saat bellek, 1.000.000 fonksiyon çağrısı, 5.000 görsel dönüştürme; fonksiyon en fazla 300 sn; günde 100 dağıtım; çalışma günlükleri 1 saat; WAF özel kuralları en fazla 3 | Doğrulandı | https://vercel.com/docs/plans/hobby |
| Aşımda çoğu özellik için 30 gün beklemek gerekiyor | Doğrulandı | https://vercel.com/docs/plans/hobby |
| Vercel `x-forwarded-for`'u üzerine yazıyor ve dış IP'leri iletmiyor (IP sahteciliğini önlemek için); `x-real-ip` aynı; `x-vercel-ip-country`, `x-vercel-ip-country-region`, `x-vercel-ip-city` (ASCII dışı karakterler RFC 3986 ile kodlanmış) | Doğrulandı | https://vercel.com/docs/headers/request-headers |
| Vercel'de Node 24.x varsayılan, 22.x de mevcut | Doğrulandı (sayfa 2026-02-27 tarihli) | https://vercel.com/docs/functions/runtimes/node-js/node-js-versions |

Doğrulanmamış kalanlar:
- Kurgusal bir markanın satış yapmayan katalog demosunun ve portfolyo projesinin ticari kullanım sayılmadığı (sayfada açık örnek yok). Bu riske karşı demo bandının markanın kurgusal olduğunu ve hiçbir şeyin satışta olmadığını söylemesine karar verdim ([ADR 0001](../adr/0001-mimari-nextjs-16-app-router.md)).
- Coğrafi konum başlıklarının Hobby'de de geldiği (sayfa plan ayrımı yapmıyor).
- Vercel'in Node 26'yı ne zaman ekleyeceği.

## 8. Node ve paket yöneticisi

| İddia | Durum | Kaynak |
|---|---|---|
| Node 24: LTS 2025-10-28, bakım 2026-10-20, ömür sonu 2028-04-30. Node 26: LTS 2026-10-28, ömür sonu 2029-04-30. Son Node 24 sürümü 24.22.1 | Doğrulandı | https://raw.githubusercontent.com/nodejs/Release/main/schedule.json · https://nodejs.org/docs/latest-v24.x/api/corepack.html |
| Corepack Node 24'te var (deneysel); Node 25'ten itibaren dağıtılmıyor | Doğrulandı | https://nodejs.org/docs/latest-v24.x/api/corepack.html |
| pnpm `latest` 12.15.0 | Doğrulandı | https://registry.npmjs.org/-/package/pnpm/dist-tags |

## 9. next-intl

| İddia | Durum | Kaynak |
|---|---|---|
| En güncel sürüm 4.14.9 (2026-10-02) | Doğrulandı | https://github.com/amannn/next-intl/releases · https://registry.npmjs.org/-/package/next-intl/dist-tags |
| Peer: `next ^12 \|\| ^13 \|\| ^14 \|\| ^15 \|\| ^16`, `react ... \|\| ^19.0.0` | Doğrulandı | https://registry.npmjs.org/next-intl/4.14.9 |
| App Router + `[locale]` segmenti: `src/i18n/routing.ts` (`defineRouting`), `src/i18n/navigation.ts` (`createNavigation`), `src/i18n/request.ts`, `src/proxy.ts` içinde `export default createMiddleware(routing)`; varsayılan matcher `/((?!api\|trpc\|_next\|_vercel\|.*\\..*).*)` | Doğrulandı | https://next-intl.dev/docs/routing/setup · https://next-intl.dev/docs/getting-started/app-router/with-i18n-routing |
| Statik render için önerilen yol `next/root-params` (Next.js 16.3+ varsayılan); `setRequestLocale` eski yol olarak destekleniyor; `generateStaticParams` ile diller | Doğrulandı | https://next-intl.dev/docs/routing/setup |
| 4.14.5'te Cache Components ile daha iyi çalışmak için `useRouter`/`Link` iyileştirmesi | Doğrulandı | https://github.com/amannn/next-intl/releases |

Doğrulanmamış kalanlar:
- next-intl'in Cache Components açıkken tam uyumu (dokümanda ele alınmamış).
- next-intl proxy'sinin nonce üreten CSP koduyla aynı `proxy.ts`'te birleştirilme biçimi; Faz 4–5'te test edeceğim.

## 10. Tailwind CSS 4

| İddia | Durum | Kaynak |
|---|---|---|
| En güncel sürüm 4.3.3 (2026-07-16); `v3-lts` 3.4.19 | Doğrulandı | https://github.com/tailwindlabs/tailwindcss/releases · https://registry.npmjs.org/-/package/tailwindcss/dist-tags |
| Next.js kurulumu: `tailwindcss @tailwindcss/postcss postcss`; `postcss.config.mjs` içinde `"@tailwindcss/postcss": {}`; CSS'te `@import "tailwindcss";` | Doğrulandı | https://tailwindcss.com/docs/installation/framework-guides/nextjs |
| Next.js 16'nın yeni proje şablonu Tailwind CSS içeriyor ve Turbopack varsayılan (yani Turbopack ile birlikte çalışıyor) | Doğrulandı | https://nextjs.org/blog/next-16 |
| `@theme` ad alanları: `--color-*`, `--font-*`, `--spacing`, `--radius-*`, `--shadow-*`, `--breakpoint-*`; `--color-*: initial` ile ad alanı sıfırlanıyor; `@theme inline` başka değişkene başvuran token'lar için; `@theme static` hepsini yazdırıyor; token'lar ayrı bir CSS dosyasında paylaşılabiliyor | Doğrulandı | https://tailwindcss.com/docs/theme |
| Next.js 16'da `sass-loader` 16'ya çıktı (modern Sass API); Turbopack `~` önekli Sass import'unu desteklemiyor | Doğrulandı | https://nextjs.org/docs/app/guides/upgrading/version-16 |

## 11. Vitest ve Testing Library

| İddia | Durum | Kaynak |
|---|---|---|
| Vitest `latest` 5.0.5; Vitest 5, Node >= 22.12 ve Vite >= 6.4 istiyor; `@vitest/coverage-v8` 5.0.5 | Doğrulandı | https://registry.npmjs.org/-/package/vitest/dist-tags · https://vitest.dev/blog/vitest-5 |
| Vitest 5'te `clearMocks` varsayılan `true`; `await` edilmemiş async doğrulamalar testi düşürüyor | Doğrulandı | https://vitest.dev/blog/vitest-5 |
| `@testing-library/react` `latest` 16.3.3; peer `react ^18 \|\| ^19`, `@testing-library/dom ^10` | Doğrulandı | https://registry.npmjs.org/@testing-library/react/16.3.3 |
| Next.js rehberi: Vitest async Server Component'leri desteklemiyor; senkron sunucu ve istemci bileşenleri birim test edilebiliyor; async bileşenler için uçtan uca test öneriliyor; kurulum `vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths`, ortam `jsdom` | Doğrulandı | https://nextjs.org/docs/app/guides/testing/vitest |
| Kapsam eşiği glob başına verilebiliyor (`coverage.thresholds['src/server/**']`); glob'lar genel eşikleri devralmıyor; glob'a giren dosyalar genel eşiğe de sayılıyor; `perFile` ayrı ayrı verilmeli; `autoUpdate` eşiği yükseltebiliyor; varsayılan sağlayıcı v8 | Doğrulandı | https://vitest.dev/config/coverage |
| **`coverage.include` varsayılanı yalnız test sırasında içe aktarılan dosyalar**; hiç test edilmeyen dosya kapsama girmiyor | Doğrulandı | https://vitest.dev/config/coverage |
| GitHub'ın Ubuntu çalıştırıcılarında Postgres servis konteyneri (`pg_isready` sağlık kontrolüyle) kullanılabiliyor | Doğrulandı | https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers |

Doğrulanmamış kalanlar:
- `@vitejs/plugin-react` `latest` 6.1.2'nin Vitest 5 ile birlikte çalıştığı (peer'leri ayrıca kontrol etmedim).
- Server Action'ların Next.js çalışma ortamı olmadan doğrudan fonksiyon olarak test edilebileceği (yaygın uygulama; resmi dokümanda görmedim).

## 12. Semgrep CE

| İddia | Durum | Kaynak |
|---|---|---|
| Semgrep CE motoru LGPL-2.1; son sürüm v1.182.0 (2026-10-20) | Doğrulandı | https://docs.semgrep.dev/licensing · https://github.com/semgrep/semgrep/releases |
| Semgrep'in bakımını yaptığı kurallar "Semgrep Rules License v1.0" ile geliyor: yalnız kendi iç iş amaçların için kullanım; kuralları dağıtmak veya başkalarına hizmet olarak sunmak yasak; kopyalanan kuralda lisans notu korunmalı | Doğrulandı | https://semgrep.dev/legal/rules-license · https://docs.semgrep.dev/licensing |
| Hesapsız istemciye dönen kural sayıları: `p/typescript` 74, `p/react` 4, `p/secrets` 52, `p/owasp-top-ten` 559; hepsi Semgrep Rules License v1.0 | Doğrulandı (`https://semgrep.dev/c/p/<ad>` adreslerini indirip saydım) | https://semgrep.dev/c/p/typescript · https://semgrep.dev/c/p/react · https://semgrep.dev/c/p/secrets · https://semgrep.dev/c/p/owasp-top-ten |
| **`p/nextjs` var (HTTP 200) ama hesapsız istemciye boş dönüyor (`rules: []`)**; olmayan bir set 404 veriyor | Doğrulandı | https://semgrep.dev/c/p/nextjs |
| `semgrep scan` hesap gerektirmeden çalışıyor; `--baseline-commit` yalnız o commit'te olmayan bulguları gösteriyor; `--error` bulguda 1 ile çıkıyor; `--sarif` çıktısı var | Doğrulandı | https://docs.semgrep.dev/cli-reference |

Doğrulanmamış kalanlar:
- Herkese açık, MIT lisanslı bir projenin CI'ında hazır kural setlerini çalıştırmanın "iç iş amacı" sayılıp sayılmadığı; lisans bunu açıkça ele almıyor. Bu belirsizlik ve ince CE kapsamı yüzünden registry setlerini hiç kullanmamaya karar verdim; Semgrep yalnız projeye özel kurallarla çalışıyor ([ADR 0008](../adr/0008-ci-ve-koruma-katmanlari.md)).
- `p/nextjs` içeriğinin yalnız ücretli kurallardan oluştuğu (çıkarım).
- `--baseline-commit`'in CE'de girişsiz çalıştığı. Registry setleri kullanılmadığı ve projeye özel kurallar her zaman bütün kodda çalıştığı için bu doğrulama artık gerekmiyor.

## 13. GitHub CodeQL (herkese açık repo)

| İddia | Durum | Kaynak |
|---|---|---|
| Herkese açık repolarda code scanning ve secret scanning (push protection dahil) ücretli ürün gerektirmiyor; özel repolarda GitHub Code Security / Secret Protection gerekiyor | Doğrulandı | https://docs.github.com/en/get-started/learning-about-github/about-github-advanced-security |
| CodeQL lisansı: GitHub.com'da barındırılan, OSI onaylı lisanslı açık kaynak kodda CI içinde kullanım serbest | Doğrulandı | https://github.com/github/codeql-cli-binaries/blob/main/LICENSE.md |
| Varsayılan kurulum: dil, sorgu seti ve tetikleyicileri GitHub seçiyor; varsayılan dala ve korunan dallara push'ta, varsayılan dala açılan PR'larda (fork'lardan gelenler hariç) ve haftalık çalışıyor; artık özel bir yapılandırma dosyası da birleştirilebiliyor | Doğrulandı | https://docs.github.com/en/code-security/concepts/code-scanning/setup-types |
| Gelişmiş kurulum: repoda `github/codeql-action` kullanan bir iş akışı dosyası; varsayılan kuruluma geçmek mevcut iş akışını devre dışı bırakıyor | Doğrulandı | https://docs.github.com/en/code-security/code-scanning/enabling-code-scanning/configuring-default-setup-for-code-scanning |
| CodeQL GitHub Actions iş akışlarını (`.github/workflows/*.yml`) ve JavaScript/TypeScript'i (React dahil) destekliyor; Next.js ayrıca listelenmiyor | Doğrulandı | https://codeql.github.com/docs/codeql-overview/supported-languages-and-frameworks/ |
| `github/codeql-action` son sürümü v4.39.1 | Doğrulandı | https://github.com/github/codeql-action/releases |

Doğrulanmamış kalanlar:
- Varsayılan kurulumun zorunlu kontrol olarak kullanılabilirliği (planımda CodeQL zorunlu kontrol değil, önemi yok).

## 14. GitHub'ın barındırdığı çalıştırıcılar, gitleaks ve Dependabot

| İddia | Durum | Kaynak |
|---|---|---|
| Herkese açık repolarda standart GitHub çalıştırıcıları ücretsiz ve sınırsız; büyük çalıştırıcılar herkese açık repoda da ücretli | Doğrulandı | https://docs.github.com/en/actions/reference/runners/github-hosted-runners · https://docs.github.com/en/billing/concepts/product-billing/github-actions |
| Herkese açık repoda `ubuntu-latest`: 4 CPU, 16 GB RAM, 14 GB SSD | Doğrulandı | https://docs.github.com/en/actions/reference/runners/github-hosted-runners |
| gitleaks son sürümü v8.30.1 (2026-03-21), MIT | Doğrulandı | https://github.com/gitleaks/gitleaks/releases |
| gitleaks-action v2'den beri MIT değil, Gitleaks LLC'nin son kullanıcı sözleşmesiyle geliyor; kişisel hesaplarda lisans anahtarı gerekmiyor, organizasyonlarda gerekiyor | Doğrulandı | https://github.com/gitleaks/gitleaks-action · https://github.com/gitleaks/gitleaks-action/blob/master/LICENSE.txt |
| Marketplace'te gitleaks-action ve pnpm/action-setup (v6.1.0) GitHub tarafından onaylı değil, "üçüncü taraf" | Doğrulandı | https://github.com/marketplace/actions/gitleaks · https://github.com/marketplace/actions/setup-pnpm |
| Dependabot güvenlik güncellemeleri GitHub'daki bütün repolarda var; herkese açık repolarda Dependabot uyarıları varsayılan olarak üretiliyor; uyarı atamak ücretli lisans istiyor | Doğrulandı | https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-security-updates · https://docs.github.com/en/code-security/dependabot/dependabot-alerts/viewing-and-updating-dependabot-alerts · https://docs.github.com/en/code-security/dependabot/dependabot-alerts/about-dependabot-alerts |
| Güvenlik güncellemeleri ekosistem başına gruplanabiliyor; farklı ekosistemler ve sürüm güncellemeleriyle güvenlik güncellemeleri aynı grupta birleşmiyor | Doğrulandı | https://docs.github.com/en/code-security/dependabot/dependabot-security-updates/about-dependabot-security-updates |

Doğrulanmamış kalanlar:
- Dependabot sürüm güncellemelerinin ücretsiz olduğu (dokümanda fiyat yok; ücretli ürün listesinde de yok).
- gitleaks'in doğrulanmış yayıncı olup olmadığı yalnız Marketplace sayfasından; organizasyon düzeyindeki "verified creator" listesine ayrıca bakmadım.
