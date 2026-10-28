# ADR 0007: Test stratejisi — Vitest + Testing Library, gerçek Postgres, %80 kapsam, testsiz kod kapısı

Durum: Kabul edildi
Tarih: 2026-10-28

## Bağlam

Eski kodda hiç test yoktu. Plan §1 hedeflerimden biri testsiz kodun `main`'e girmemesi. Plan §2, §3 (kural 8 ve 9) ve §5'teki kararlarım:

- Vitest + Testing Library.
- Entegrasyon testleri gerçek Postgres üzerinde: yerelde Docker Compose, CI'da servis konteyneri. Veritabanı taklit edilmez; yalnız dış HTTP çağrıları (ör. Google) taklit edilir.
- Tarayıcı test aracı yok. Arayüz değişiklikleri masaüstü (1440) ve mobil (390) genişlikte tarayıcıda görsel olarak kontrol edilir; PR gövdesindeki "Görsel kontrol" bölümü doldurulur.
- Kapsam eşiği: sunucu katmanında (`src/server`, `src/lib`) %80 satır. Eşik yalnız yükselir. Bileşenler eşiğe dahil değil ama testleri yazılır.
- Testsiz kod kapısı: `src/` altında TypeScript ekleyen veya değiştiren her PR aynı PR'da test ekler veya değiştirir. Yalnız silme yapan PR'lar ve yalnız stil, içerik veya doküman değişiklikleri muaf. Kapı commit tipine bakar: `feat`, `fix`, `refactor`, `perf`, `revert` commit'leri kapsamda; `style`, `docs`, `ci`, `build`, `chore`, `test` muaf.

Doğruladığım gerçekler ([araştırma kaydı](../research/2026-10-28-teknoloji-dogrulamasi.md), bölüm 11):

- Vitest'in en güncel sürümü 5.0.5; Node >= 22.12 ve Vite >= 6.4 istiyor. Vitest 5'te `clearMocks` varsayılan `true`; `await` edilmemiş async doğrulamalar testi düşürüyor.
- `@testing-library/react` 16.3.3 React 19'u destekliyor; `@testing-library/dom` 10'u peer olarak istiyor.
- **Next.js dokümanı: Vitest async Server Component'leri desteklemiyor.** Senkron sunucu ve istemci bileşenleri birim test edilebiliyor; async bileşenler için uçtan uca test öneriliyor.
- Kapsam eşiği glob başına verilebiliyor. Glob'lar genel eşikleri devralmıyor; `perFile` her glob'da ayrıca verilmeli.
- **`coverage.include` varsayılanı yalnız test sırasında içe aktarılan dosyalar.** Hiç test edilmeyen bir dosya kapsama hiç girmiyor, yani eşiği düşürmüyor.
- GitHub'ın Ubuntu çalıştırıcılarında Postgres servis konteyneri kullanılabiliyor.

## Seçenekler

| Seçenek | Artıları | Eksileri |
|---|---|---|
| Vitest + Testing Library, gerçek Postgres; tarayıcı test aracı yok, görsel kontrol | Hızlı; ESM ve TypeScript yapılandırmasız; Next.js'in resmi rehberi var; gerçek veritabanıyla sorgu ve migration hataları yakalanır | Async Server Component'ler ve tam kullanıcı akışları otomatik test edilmez |
| Jest + Testing Library | Yaygın | ESM ve TypeScript için ek yapılandırma; plan dışı |
| Yukarıdakine ek olarak tarayıcı tabanlı uçtan uca test | Async sayfaları ve akışları gerçek tarayıcıda sınar | CI süresi ve bakım yükü; plan §2'de bilerek dışarıda bıraktım |
| Veritabanını taklit etmek | Hızlı | Sorgu, kısıt ve migration hatalarını kaçırır; plan §5'e aykırı |

## Karar

Plan §2, §3 ve §5'teki kararı olduğu gibi kaydediyorum: **Vitest + Testing Library; gerçek Postgres; sunucu katmanında %80 satır kapsamı (yalnız yükselir); testsiz kod kapısı; tarayıcı test aracı yok; arayüz değişikliği görsel kontrolle doğrulanır.**

Uyacağım kurallar:

1. **İki Vitest projesi:** `unit` (bileşenler için `jsdom` ortamı ve Testing Library) ve `integration` (`node` ortamı, gerçek Postgres). Entegrasyon testleri her çalışmada temiz bir şemaya migration uygular ve testler arasında veriyi temizler.
2. **Async Server Component kuralı:** sayfalar ve async sunucu bileşenleri ince tutulur. Veri okuma, yetki kontrolü, doğrulama ve yazma `src/server` (saf yardımcılar `src/lib`) altındaki fonksiyonlarda yapılır ve orada entegrasyon veya birim testiyle sınanır. Sayfa yalnız bu fonksiyonları çağırıp sonucu senkron bileşenlere verir; senkron bileşenler Testing Library ile test edilir.
3. **Kapsam:**
   - Sağlayıcı v8.
   - `coverage.include` açıkça `src/server/**` ve `src/lib/**` olarak yazılır; testi olmayan dosya da %0 olarak sayılır.
   - Eşikler glob başına verilir, ör. `thresholds: { 'src/server/**': { lines: 80 }, 'src/lib/**': { lines: 80 } }`.
   - Eşik değerini düşüren bir değişiklik CI `policy` işinde reddedilir ("yalnız yükselir"). `autoUpdate` kullanılmaz; eşiği elle ve ayrı bir commit'le yükseltirim.
4. **Geçiş dönemi yok** (plan §2, D1): kapsam eşiği ilk günden `src/server/**` ve `src/lib/**`'te geçerli.
5. **Testsiz kod kapısı:** CI `policy` işi PR'daki commit tiplerine ve değişen yollara bakar. `src/` altında TypeScript değiştiren `feat`/`fix`/`refactor`/`perf`/`revert` commit'leri varsa PR'da bir test dosyası da değişmiş olmalıdır. Kuralın kendisi `node --test` ile testlidir.
6. **Taklit sınırı:** veritabanı ve Prisma taklit edilmez. Yalnız dış HTTP servisleri (Google Ads API, SMTP) taklit edilir.
7. **Görsel kontrol:** arayüze dokunan her PR'da masaüstü (1440) ve mobil (390) genişlikte tarayıcı kontrolü yapılır ve PR şablonundaki "Görsel kontrol" bölümü doldurulur (plan kural 9).
8. Yerelde `pnpm test` ile CI'daki `test` işi aynı komutları çalıştırır: aynı Postgres ana sürümü, aynı migration'lar.

## Sonuçlar

- Olumlu: Sunucu katmanı (yetki, demo koruması, rate limit, yükleme doğrulaması, şifreleme) gerçek veritabanıyla test edilir. En yüksek riskli kod en sıkı kapıdan geçer.
- Olumlu: `coverage.include` açık yazıldığı için testsiz yeni bir sunucu dosyası eşiği düşürür ve CI'ı kırar.
- **Kabul ettiğim boşluk:** Next.js async Server Component'ler için uçtan uca test öneriyor. Tarayıcı test aracı kullanmadığım için sayfa düzeyinde render, yönlendirme ve tam giriş akışı otomatik sınanmaz. Bu boşluğu bilerek kabul ediyorum ve şu tasarım kuralıyla daraltıyorum:
  - Async Server Component'ler ince kalır; bütün mantık test edilebilir sunucu modüllerinde (`src/server`, `src/lib`) durur ve orada test edilir (kural 2).
  - Render'ı görsel kontrol karşılar (kural 7).

  Kalan risk: bir sayfanın yanlış fonksiyonu çağırması ya da yetki çağrısını unutması. Bu risk kod incelemesinde ve görsel kontrolde aranır.
- Olumsuz: Entegrasyon testleri Postgres gerektirdiği için yerelde Docker şart. Geliştirme ortamı rehberinde anlatılır.
- Takip: Vitest 5'in varsayılan değişiklikleri (`clearMocks`, `await` edilmemiş doğrulamalar) baştan bu varsayılanlarla yazıldığı için ek iş çıkarmaz.

## Kaynaklar

- [Araştırma kaydı](../research/2026-10-28-teknoloji-dogrulamasi.md), bölüm 11
- https://nextjs.org/docs/app/guides/testing/vitest
- https://vitest.dev/blog/vitest-5
- https://vitest.dev/config/coverage
- https://registry.npmjs.org/-/package/vitest/dist-tags
- https://registry.npmjs.org/@testing-library/react/16.3.3
- https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers
