# Mimari kararlar (ADR)

Bu klasörde projenin mimari kararları duruyor: her biri numaralı, tarihli ve durumlu. Bir karar değişince eski ADR silinmez ya da yeniden yazılmaz; yeni bir ADR açılır ve eskisinin durum satırı "Yerini aldı: ADR NNNN" olur. Kararlardan önceki araştırmalar [research/](../research/2026-10-28-teknoloji-dogrulamasi.md) altında.

| No | Karar | Durum | Tarih |
|---|---|---|---|
| [0001](0001-mimari-nextjs-16-app-router.md) | Mimari: Next.js 16 App Router; Vercel'de çalışır ama kilitlenmez; bütün sayfalarda nonce tabanlı CSP | Kabul edildi | 2026-10-28 |
| [0002](0002-veri-ve-depolama.md) | Veri ve depolama: Postgres (Neon), Prisma 7, Vercel Blob; paylaşılan önizleme veritabanı; sunucudan yükleme | Kabul edildi | 2026-10-28 |
| [0003](0003-kimlik-dogrulama.md) | Kimlik doğrulama: Better Auth (e-posta/şifre, veritabanında oturum) | Kabul edildi | 2026-10-28 |
| [0004](0004-rate-limit.md) | Rate limit: Postgres üzerinde, ek servis yok | Kabul edildi | 2026-10-28 |
| [0005](0005-stil-tailwind-css-4.md) | Stil: Tailwind CSS 4, SCSS yok | Kabul edildi | 2026-10-28 |
| [0006](0006-cok-dillilik-next-intl.md) | Çok dillilik: next-intl, her zaman önekli `/tr` ve `/en`, `proxy.ts` | Kabul edildi | 2026-10-28 |
| [0007](0007-test-stratejisi.md) | Test stratejisi: Vitest + Testing Library, gerçek Postgres, %80 kapsam, testsiz kod kapısı | Kabul edildi | 2026-10-28 |
| [0008](0008-ci-ve-koruma-katmanlari.md) | CI ve koruma katmanları: GitHub'ın barındırdığı çalıştırıcılar, zorunlu kontroller, dal koruması, CodeQL, Semgrep (yalnız proje kuralları), gitleaks, Dependabot | Kabul edildi | 2026-10-28 |

Bazı ADR'lerin Sonuçlar bölümünde "Açık kalanlar" maddeleri var. Bunlar ana karara bağlı, henüz karara bağlamadığım uygulama ayrıntıları; her birinin karara bağlanacağı faz yanında yazıyor.

## Durumlar

- **Önerildi:** karar yazıldı, onayımı bekliyor.
- **Kabul edildi:** karar verdim, uygulanıyor.
- **Reddedildi:** değerlendirdim, uygulamıyorum.
- **Yerini aldı: ADR NNNN:** yeni bir karar bunun yerini aldı.

## Yeni ADR

1. [sablon.md](sablon.md) dosyasını bir sonraki numarayla `NNNN-kebab-case.md` adıyla kopyalarım (ASCII, Türkçe karakter yok).
2. Bölümleri doldururum: Bağlam, Seçenekler (karşılaştırma tablosu), Karar, Sonuçlar, Kaynaklar. Her gerçek için bir kaynak ya da araştırma kaydı bağlantısı eklerim.
3. Bu tabloya satırını eklerim; ADR'yi uygulayan PR'lar ADR'ye bağlantı verir.
