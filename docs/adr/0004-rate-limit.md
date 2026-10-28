# ADR 0004: Rate limit — Postgres üzerinde, ek servis yok

Durum: Kabul edildi
Tarih: 2026-10-28

## Bağlam

Eski kodda rate limit yalnız Express sunucusunda ve bellekteydi; şifre sıfırlama kodunda deneme sınırı yoktu (G-09). Vercel'de her istek ayrı bir fonksiyon örneğine düşebildiği için bellek içi sayaç sunucusuz ortamda paylaşılmaz. Plan §2 ve §5 kararım: **rate limit Postgres üzerinde, ek servis yok.** Giriş ve şifre sıfırlama uçlarında kimlik doğrulama kütüphanesinin veritabanı depolamalı sınırlayıcısı kullanılır. İletişim formu gibi diğer herkese açık yazma uçlarında aynı veritabanında küçük bir sayaç tablosu tutulur.

Doğruladığım gerçekler ([araştırma kaydı](../research/2026-10-28-teknoloji-dogrulamasi.md), bölüm 3.1, 4, 7):

- Better Auth'ta rate limit üretimde varsayılan açık, geliştirmede kapalı. Depolama varsayılanı bellek. `storage: "database"` ile `rateLimit` tablosuna geçiyor; yol başına `customRules` verilebiliyor.
- **Sunucu tarafı `auth.api` çağrıları sınırlanmıyor**, yalnız istemciden gelen istekler sınırlanıyor.
- Better Auth IP'yi varsayılan olarak `x-forwarded-for`'dan okuyor ve IPv6'yı /64 alt ağına göre grupluyor. Vercel `x-forwarded-for`'u kendisi yazıyor ve dışarıdan gelen değeri iletmiyor.
- Postgres'te veritabanı depolamalı sınırlayıcıda bir yarış durumu bildirildi (GHSA-44jh-23m7-hpcf, düşük önem). Bildirim Drizzle ve Kysely adaptörleri için; 1.7.7'de düzeldi, Prisma adaptörü anılmıyor. 1.7.14'ün Prisma adaptörü kodunu okudum: sayaç, koşullu tek bir `UPDATE` ile transaction içinde artırılıyor. Belgede yazmadığı için bunu testle doğrulayacağım.
- Prisma, Postgres'te `upsert`'ü yalnız belirli koşullarda veritabanının `INSERT ... ON CONFLICT` komutuna çeviriyor; koşullar sağlanmazsa eşzamanlı çağrılarda P2002 hatası çıkabiliyor.

## Seçenekler

| Seçenek | Artıları | Eksileri |
|---|---|---|
| Postgres: kimlik doğrulama kütüphanesinin DB sınırlayıcısı + kendi sayaç tablom | Ek servis yok; bütün örnekler aynı sayacı görür; testte gerçek Postgres'le sınanır | Her sınırlanan istek bir DB yazması; Neon uykudaysa ilk istek yavaş |
| Bellek içi sınırlayıcı | Basit, hızlı | Sunucusuz ortamda örnekler arasında paylaşılmıyor; fiilen sınır yok |
| Harici KV/Redis servisi | Hızlı, atomik sayaçlar | Ek servis, hesap ve gizli bilgi; plan §2'ye aykırı |
| Vercel WAF rate limit kuralları | Uygulamadan önce keser | Vercel'e özgü (kilitlenme); Hobby'de en fazla 3 özel kural; yerelde ve CI'da sınanamaz |

## Karar

Plan §2 ve §5'teki kararı olduğu gibi kaydediyorum: **rate limit Postgres üzerinde; bellek içi sınırlayıcı yok, ek servis yok.**

Uyacağım kurallar:

1. **Giriş ve şifre sıfırlama:** kimlik doğrulama kütüphanesinin (Better Auth, [ADR 0003](0003-kimlik-dogrulama.md)) sınırlayıcısı kullanılır. Ayarı `rateLimit: { enabled: true, storage: "database", customRules: { … } }`. `enabled: true` açıkça yazılır ki geliştirmede ve testte de çalışsın. Giriş ve sıfırlama isteği uçları için dar pencereli, düşük sınırlı kurallar konur; değerleri Faz 4'te belirleyip testle sabitleyeceğim.
2. **Giriş ve sıfırlama formları tarayıcıdan doğrudan `/api/auth/*` handler'ına gider.** Sunucu API'si (`auth.api.*`) ile giriş yapılmaz; yapılırsa sınırlayıcı devre dışı kalır ([ADR 0003](0003-kimlik-dogrulama.md), kural 3).
3. **Diğer herkese açık yazma uçları** (iletişim formu ve benzerleri) için `src/server/rate-limit` modülü ve aynı veritabanında bir sayaç tablosu (`RateLimitCounter`: anahtar, pencere başlangıcı, sayaç) kullanılır.
   - Artırma tek bir atomik ifadeyle yapılır: Prisma'nın veritabanı upsert koşullarına uyan bir `upsert` ya da parametreli `$executeRaw` ile `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING`. Önce okuyup sonra yazan iki adımlı kod yasak.
   - Süresi geçen satırlar ara sıra silinir.
4. **Anahtar:** uç adı ve istemci IP'si. IP yalnız sunucunun kendi yazdığı başlıktan okunur. Vercel'de bu `x-forwarded-for`; Vercel dışında güvenilir vekil (`trustedProxies`) yapılandırılmadan başlığa güvenilmez.
5. Sınır aşılınca 429 ve `Retry-After` döner.
6. Kimlik doğrulama kütüphanesi değişirse 1. maddedeki uçlar da 3. maddedeki sayaç tablosuna geçer. Kural aynı kalır: Postgres, ek servis yok.

## Sonuçlar

- Olumlu: G-09 kapanır. Sınırlar bütün fonksiyon örneklerinde ortaktır ve gerçek Postgres'le test edilir.
- Olumlu: Vercel'e özgü bir rate limit servisine bağlanılmaz; yerelde ve CI'da aynı davranış görülür.
- Olumsuz: Sınırlanan her istek bir veritabanı yazması yapar. Neon Free'nin aylık 100 CU-saati düşük trafikli demo için yeterli görünüyor; Faz 9'da ölçerim.
- Risk: IPv6 adres döndürme ve yol normalleştirme gibi atlatma türleri kütüphanede daha önce bildirildi ve yamalandı. Kütüphane sürümü güncel tutulur. Kendi sayacımda yol normalleştirmesi Next.js'e bırakılır; anahtar uç adından üretilir, ham yoldan değil.
- Zorunlu testler:
  - Sınırın tam eşikte devreye girdiği.
  - Pencere bitince sayacın sıfırlandığı.
  - Eşzamanlı N isteğin sınırı aşmadığı (hem kütüphanenin Prisma adaptörü hem kendi sayacım için).
  - `x-forwarded-for` başlığı sahte değerlerle gönderildiğinde Vercel dışı yapılandırmada güvenilmediği.
- Açık kalan (bu ADR'de karara bağlanmadı): kendi sayaç tablomda anahtarın düz IP yerine sunucudaki bir gizli anahtarla HMAC'lenmiş IP'den üretilmesi. Ön önerim bu, çünkü plan §5'teki "IP adresleri anonimleştirilerek saklanır" ilkesiyle ve G-11 ile tutarlı. Faz 4'teki rate limit PR'ında karara bağlarım. Kütüphanenin kendi `rateLimit` tablosunun anahtar biçimi kütüphaneye ait.

## Kaynaklar

- [Araştırma kaydı](../research/2026-10-28-teknoloji-dogrulamasi.md), bölüm 3.1, 4, 7
- https://www.better-auth.com/docs/concepts/rate-limit
- https://www.better-auth.com/docs/reference/options
- https://github.com/better-auth/better-auth/security/advisories/GHSA-44jh-23m7-hpcf
- https://github.com/better-auth/better-auth/releases/tag/v1.7.7
- https://www.prisma.io/docs/orm/reference/prisma-client-reference
- https://vercel.com/docs/headers/request-headers
- https://vercel.com/docs/plans/hobby
