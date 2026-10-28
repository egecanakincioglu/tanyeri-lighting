# ADR 0010: Kalite eşikleri — Lighthouse kapısı 90, beklenen 95+

Durum: Kabul edildi
Tarih: 2026-10-28

## Bağlam

[ADR 0009](0009-kalite-hedefleri.md)'da Lighthouse'un dört kategorisi (performans, erişilebilirlik, en iyi uygulamalar, SEO) için mobilde ve masaüstünde kesin 100 kapısı koymuştum. Bunun bedelleri:

- Koşular arası oynamaya karşı pay yok; tek puanlık düşüş PR'ı kırmızıya çeviriyor.
- Mobilde 100'ü tutmak için her şablonda LCP öğesinin metin olması gerekiyordu (ADR 0009, kural 4). Görsel LCP'li sayfa ölçümümde mobilde 98–99 aldı ([araştırma kaydı](../research/2026-10-28-kalite-hedefleri.md)); kural tasarımı yalnız performans için bütün şablonlarda kısıtlıyordu.
- TBT (mobil 90 ms, masaüstü 60 ms) ve CLS (0,02) bütçeleri yalnız puanı 100'de tutmak için konmuştu.

100 fazla katı; hedefin gerçekçi olmasını istiyorum.

## Seçenekler

| Seçenek | Artıları | Eksileri | Sonuç |
|---|---|---|---|
| Kesin 100 (ADR 0009) | Tam puan her PR'da kanıtlanır | Oynamaya pay yok; mobilde görsel ilk ekran yasak; bütçeler puana göre dar | Elendi |
| Kapı 90, beklenen 95+ | Oynamaya pay var; tasarım serbestleşir; düşüş yine görünür | 100 kanıtlanmaz | Seçildi |
| Yalnız uyarı, kapı yok | En esnek | Gerileme birleşebilir; plan §2'deki "Lighthouse kapıları yok" durumuna döner | Elendi |

## Karar

**Lighthouse kapısını 90'a indiriyorum; beklentim 95 ve üstü.** ADR 0009'un burada anılmayan kuralları aynen geçerli.

Uyacağım kurallar:

1. **Lighthouse eşikleri.** Dört kategori, mobil ve masaüstü, şablon başına üç koşunun medyanı (ADR 0009, kural 3):
   - 90'ın altı: `site-audit (mobile)` ya da `site-audit (desktop)` kırmızı.
   - 90–94: iş yeşil kalır; sayfa ve kategori GitHub uyarı notu (annotation) olarak yazılır ve iş özetinde listelenir.
   - 95 ve üstü: beklenen düzey.
   - Eşikler `tooling/site-audit/thresholds.json`'da; yalnız yükselir, 90'ın altına inmez. `policy` gevşetmeyi reddeder; sıkılaştırma ayrı bir commit'tir.
2. **Geç/kal denetimler değişmiyor.** Puan vermedikleri için 90/95 ayrımı bunlara uygulanmaz: axe ihlali 0; "Agentic Browsing"de uygulanabilir denetimlerin hepsi geçer; yatay taşma 0; `target-size` ihlali 0; konsol hatası ve CSP ihlali 0; SEO ve GEO HTTP denetimleri; JavaScript'siz iletişim formu (ADR 0009, kural 1 ve 5).
3. **Mobilde metin LCP zorunluluğu kalkıyor.** ADR 0009'un 4. kuralı ve `site-audit (mobile)`'daki "LCP öğesi metin" denetimi uygulanmaz. Görsel LCP serbest; ilk ekrandaki görsel ADR 0009 kural 6'daki gibi `preload`, `fetchPriority="high"` ve doğru `sizes`'la yüklenir.
4. **İlk ekran tasarım kuralı kalıyor.** Ana sayfanın ilk ekranında değer önermesi olan tek `h1` ve eylem düğmeleri bulunur. Bu artık performans değil tasarım gereği (DZ-01, [tasarım incelemesi](../research/2026-10-28-tasarim-incelemesi.md)).
5. **Bütçeler.** ADR 0009 kural 6'daki tablonun yerine:

   | Ölçü | Mobil | Masaüstü |
   |---|---|---|
   | Lighthouse performans (medyan) | en az 90, beklenen 95+ | aynı |
   | JavaScript aktarımı | en fazla 180 KB | aynı |
   | CSS aktarımı | en fazla 30 KB | aynı |
   | Font | en fazla 2 dosya, 100 KB | aynı |
   | Toplam aktarım | en fazla 500 KB | aynı |

   TBT, CLS ve LCP öğesi satırları kalktı: puanı 100'de tutmak için konmuşlardı, performans kapısı onları zaten kapsıyor. Aktarım bütçeleri Faz 3'te çalıştırıcıda ölçülüp kesinleşir, sonra yalnız küçülür. Kural 6'daki tasarım kuralları aynen geçerli.

## Sonuçlar

- Olumlu: Koşular arası oynama PR'ı kırmızıya çevirmiyor; mobilde ilk ekran görselle açılabiliyor; ölçüm araçları ve işler değişmiyor.
- Olumsuz: 100 artık kanıtlanmıyor; 90–94 arasındaki bir düşüş yalnız uyarıyla görünür, fark edip düzeltmek bana kalıyor.
- Değişen yerler: ADR 0009'un durum satırı, ADR dizini, plan (D7, `site-audit` satırı, Faz 4 içerik şeması ve Faz 6 ana sayfa maddeleri).

## Kaynaklar

- [ADR 0009: Kalite hedefleri](0009-kalite-hedefleri.md)
- [Kalite hedefleri araştırma kaydı](../research/2026-10-28-kalite-hedefleri.md): görsel LCP'li sayfanın mobil 98–99 ölçümü ve TBT sınırlarının hesabı.
- [Tasarım incelemesi](../research/2026-10-28-tasarim-incelemesi.md): DZ-01.
