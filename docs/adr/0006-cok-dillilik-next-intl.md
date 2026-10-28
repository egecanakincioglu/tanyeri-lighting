# ADR 0006: Çok dillilik — next-intl, `[locale]` segmenti, `proxy.ts`

Durum: Kabul edildi
Tarih: 2026-10-28

## Bağlam

Site bugün yalnız Türkçe. Plan §2 kararım: **site iki dilli, Türkçe ve İngilizce.** Plan §5'te yöntem de belli: next-intl; `messages/tr.json` ve `messages/en.json`; içerik verisinde iki dilli alanlar; dil yönlendirmesi `proxy.ts` ile; rotalar `src/app/[locale]/…` altında. Uygulama Faz 5'te.

Doğruladığım gerçekler ([araştırma kaydı](../research/2026-10-28-teknoloji-dogrulamasi.md), bölüm 9):

- next-intl'in en güncel sürümü 4.14.9. Peer aralığı `next ^16` ve `react ^19`'u kapsıyor.
- App Router kurulumu:
  - `src/i18n/routing.ts` (`defineRouting`), `src/i18n/navigation.ts` (`createNavigation`) ve `src/i18n/request.ts`.
  - `src/proxy.ts` içinde `export default createMiddleware(routing)`.
  - Varsayılan matcher `api`, `trpc`, `_next`, `_vercel` ve nokta içeren yolları dışarıda bırakıyor.
- Statik render için önerilen yol `next/root-params`; Next.js 16.3'ten beri varsayılan açık. `setRequestLocale` eski yol olarak destekleniyor.
- next-intl'in Cache Components açıkken tam uyumu dokümanda ele alınmamış.

## Seçenekler

| Seçenek | Artıları | Eksileri |
|---|---|---|
| next-intl 4 | Next.js 16 peer desteği; `proxy.ts` entegrasyonu; tipli mesajlar; dil farkındalıklı `Link`/`redirect`; `next/root-params` desteği | Ek bağımlılık; proxy'yi CSP koduyla paylaşıyor |
| Next.js'in kendi i18n rehberindeki elle kurulum (sözlük dosyaları + proxy) | Bağımlılık yok | Dil farkındalıklı gezinme, biçimlendirme ve çoğul kuralları elle yazılır; plan dışı |
| Başka bir i18n kütüphanesi | — | Araştırmadım; plan dışı |

## Karar

Plan §2 ve §5'teki kararı olduğu gibi kaydediyorum: **next-intl ile iki dilli yapı.**

Uyacağım kurallar:

1. Diller `tr` ve `en`. Arayüz metinleri `messages/tr.json` ve `messages/en.json`'da; iki dosyanın anahtar kümesi aynı olmalı. Bir test eksik veya fazla anahtarı yakalar.
2. Bütün sayfalar `src/app/[locale]/…` altında. Kök layout dili `hasLocale` ile doğrular, geçersizse `notFound()` çağırır. `<html lang>` aktif dili gösterir.
3. Sunucuda dil `next/root-params` ile okunur (next-intl'in önerdiği yol); geçerli diller `routing.locales`'tan gelir. Nonce'lu CSP yüzünden sayfalar zaten dinamik render edildiği için ([ADR 0001](0001-mimari-nextjs-16-app-router.md), kural 9) `setRequestLocale` kullanılmaz.
4. Gezinme yalnız `src/i18n/navigation.ts`'ten gelen `Link`, `redirect`, `useRouter`, `usePathname` ile yapılır. `next/link` dil dışı yollarda kullanılmaz.
5. `proxy.ts` tek dosyadır: next-intl'in proxy'si ile CSP/güvenlik başlıkları aynı fonksiyonda birleştirilir. Proxy yetki kontrolü yapmaz ([ADR 0001](0001-mimari-nextjs-16-app-router.md), kural 3). Matcher `api` yollarını ve statik dosyaları dışarıda bırakır.
6. İçerik verisindeki iki dilli alanların biçimi Faz 4'teki şema PR'ında belirlenir.
7. Metadata (`generateMetadata`), `sitemap.ts` ve `alternates.languages` iki dili de içerir.
8. **Varsayılan dil ve önek:** varsayılan dil `tr`; `localePrefix: "always"`.
   - Her adres `/tr/...` ya da `/en/...` ile başlar; iki dilin adres yapısı simetrik kalır.
   - Kök `/` isteği `Accept-Language` başlığına göre `/tr`'ye veya `/en`'e yönlendirilir; eşleşme yoksa `/tr`'ye gider.
   - Yönlendirmeyi next-intl'in dil algılamasıyla yaparım. Bu davranışı, çerezin başlığa göre önceliği dahil, Faz 5'te testle doğrularım.

## Sonuçlar

- Olumlu: Bütün rotalar dil farkındalıklı olur. Arama motorları için `hreflang` alternatifleri doğal olarak üretilir.
- Olumsuz: `proxy.ts` her sayfa isteğinde çalışır. Nonce'lu CSP ile birlikte bütün sayfalar dinamik render edilir; bu, [ADR 0001](0001-mimari-nextjs-16-app-router.md)'de kabul ettiğim maliyet.
- Not: next-intl'in Cache Components ile tam uyumu doğrulanmadı. Nonce'lu CSP yüzünden Cache Components zaten kullanılmıyor; bu karar yeniden açılırsa ayrıca denenir.
- Zorunlu testler:
  - Mesaj dosyalarında anahtar eşitliği.
  - Geçersiz dilde 404.
  - Kök `/` isteğinin `Accept-Language`'a göre `/tr`'ye veya `/en`'e, eşleşme yoksa `/tr`'ye yönlendirildiği.
  - Proxy'nin dil yönlendirmesi ve CSP başlığını birlikte ürettiği.
- Açık kalanlar (bu ADR'de karara bağlanmadı; ikisi de ön önerim):
  - Dil seçicinin davranışı: aynı sayfanın diğer dildeki karşılığına gitmesi ve seçimin next-intl'in çereziyle hatırlanması. Faz 7'deki header PR'ında karara bağlarım.
  - Eksik çeviri: iki dilli içerik alanlarının ikisinin de zorunlu olması ve sayfanın diğer dile sessizce düşmemesi. Faz 4'teki şema PR'ında karara bağlarım.

  Bunlar Vitest'le birim ve entegrasyon düzeyinde yazılır; görünüm masaüstü ve mobilde görsel olarak kontrol edilir ([ADR 0007](0007-test-stratejisi.md)).

## Kaynaklar

- [Araştırma kaydı](../research/2026-10-28-teknoloji-dogrulamasi.md), bölüm 9
- https://github.com/amannn/next-intl/releases
- https://registry.npmjs.org/next-intl/4.14.9
- https://next-intl.dev/docs/routing/setup
- https://next-intl.dev/docs/getting-started/app-router/with-i18n-routing
- https://nextjs.org/docs/app/guides/upgrading/version-16
