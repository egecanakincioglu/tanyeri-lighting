# ADR 0005: Stil — Tailwind CSS 4'e tam geçiş, SCSS kalkıyor

Durum: Kabul edildi
Tarih: 2026-10-28

## Bağlam

Bugün bütün stiller 59 SCSS modülünde (9.167 satır). Tailwind kurulu ama hiç kullanılmıyor. İki ayrı PostCSS yapılandırması ve kullanılmayan bir Tailwind 3 yapılandırması duruyor (plan §8). Faz 6'da yeni marka, Faz 7'de element hiyerarşisi, hizalama ve pixel perfect yapı ele alınacak. Yani her bileşen zaten baştan elden geçecek. Plan §2 ve §5 kararım: **Tailwind CSS 4'e tam geçiş; tasarım token'ları `@theme` içinde tek kaynakta; geçiş bileşen bileşen; bir bileşende iki sistem karışmaz; son modül kalkınca `sass` da kalkar.**

Doğruladığım gerçekler ([araştırma kaydı](../research/2026-10-28-teknoloji-dogrulamasi.md), bölüm 10):

- Tailwind'in en güncel sürümü 4.3.3; 3.x için ayrı bir LTS hattı (3.4.19) var.
- Next.js kurulumu: `tailwindcss`, `@tailwindcss/postcss` ve `postcss` paketleri; `postcss.config.mjs` içinde tek eklenti; CSS'te `@import "tailwindcss";`. Next.js 16'nın yeni proje şablonu Tailwind ile ve Turbopack varsayılanıyla geliyor.
- `@theme` ad alanları: `--color-*`, `--font-*`, `--spacing`, `--radius-*`, `--shadow-*`, `--breakpoint-*`. `--color-*: initial` ile varsayılan palet kapatılabiliyor. Başka bir değişkene başvuran token'lar (ör. `next/font` değişkeni) için `@theme inline` var.
- Next.js 16 modern Sass API'sine geçti (`sass-loader` 16). Geçiş sürerken SCSS modülleri çalışmaya devam eder.

## Seçenekler

| Seçenek | Artıları | Eksileri |
|---|---|---|
| Tailwind CSS 4, token'lar `@theme`'de | Token'lar tek kaynakta, CSS değişkeni olarak da kullanılabiliyor; ölü stil birikmiyor; Next.js 16 şablonuyla aynı kurulum | 9.167 satırlık SCSS'in yeniden yazımı; sınıf adları uzun |
| SCSS modüllerinde kalmak | Değişiklik yok | Token'lar dağınık; yeni marka ve hizalama işi yine her modüle dokunmayı gerektiriyor; `sass` bağımlılığı kalıyor |
| CSS Modules ve düz CSS değişkenleri | Ek bağımlılık yok | Ölçek ve yardımcı sınıfları kendim yazarım; plan dışı |

## Karar

Plan §2 ve §5'teki kararı olduğu gibi kaydediyorum: **Tailwind CSS 4'e tam geçiş.**

Uyacağım kurallar:

1. Kurulum resmi Next.js rehberindeki gibi yapılır: `tailwindcss` ve `@tailwindcss/postcss` aynı tam sürümde. Tek bir `postcss.config.mjs` kalır; ikinci PostCSS yapılandırması ve Tailwind 3 yapılandırması silinir.
2. **Tek token kaynağı:** `src/app/globals.css` (ya da onun içe aktardığı tek bir `theme.css`) içindeki `@theme` bloğu.
   - Renk, tipografi, boşluk ölçeği (`--spacing`), köşe, gölge ve kesme noktaları burada tanımlanır.
   - Kesme noktaları Faz 7'deki 390, 768, 1024 ve 1440 genişliklerine göre adlandırılır.
   - Fontlar `next/font` ile yüklenir ve `@theme inline` ile bağlanır.
3. Geçiş bileşen bileşen yapılır. Bir bileşen taşındığı PR'da SCSS modülü silinir; bir bileşende iki sistem bulunmaz.
4. Son SCSS modülü silindiği PR'da `sass` bağımlılığı da kalkar.

## Sonuçlar

- Olumlu: Yeni marka (Faz 6) tek bir dosyada token değiştirerek uygulanır. Hizalama ve boşluk tutarlılığı ölçekten gelir.
- Olumlu: Kullanılmayan stil üretilmez. Ölü SCSS ve iki PostCSS yapılandırması kalkar (Faz 8 temizliğinin bir kısmı).
- Olumsuz: Geçiş süresince (Faz 6–7) iki stil sistemi projede aynı anda bulunur, ama bileşen düzeyinde karışmaz.
- Olumsuz: Stil değişiklikleri birim testle değil, masaüstü (1440) ve mobil (390) genişlikte görsel kontrolle doğrulanır ([ADR 0007](0007-test-stratejisi.md), plan kural 9).
- Takip: Tailwind 4.x yama sürümleri Dependabot'un gruplu minor/patch PR'ıyla gelir.
- Açık kalanlar (Faz 6'da marka token'larıyla birlikte karara bağlarım):
  - Varsayılan renk ad alanının `--color-*: initial` ile kapatılıp yalnız marka renklerinin tanımlanması.
  - `[#123456]`, `[13px]` gibi keyfi değerlerin yalnız gerekçesi yorumla yazılarak kullanılması. Sürekli gereken değer için `@theme`'e token eklenmesi.

  İkisi de ön önerim.

## Kaynaklar

- [Araştırma kaydı](../research/2026-10-28-teknoloji-dogrulamasi.md), bölüm 10
- https://github.com/tailwindlabs/tailwindcss/releases
- https://registry.npmjs.org/-/package/tailwindcss/dist-tags
- https://tailwindcss.com/docs/installation/framework-guides/nextjs
- https://tailwindcss.com/docs/theme
- https://nextjs.org/blog/next-16
- https://nextjs.org/docs/app/guides/upgrading/version-16
