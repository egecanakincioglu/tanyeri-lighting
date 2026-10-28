# ADR 0003: Kimlik doğrulama — Better Auth (e-posta/şifre, veritabanında oturum)

Durum: Kabul edildi
Tarih: 2026-10-28

## Bağlam

Eski koddaki admin girişi kendi yazdığım koddan oluşuyordu: `jose` ile token, `bcrypt` ile hash, bellekte rate limit. Oturum token'ı adres satırında (`?state=`) kabul ediliyordu (G-05). Şifre sıfırlama kodunda deneme sınırı yoktu (G-09). Plan §2 kararım: **bakımı süren hazır bir kütüphane; kendi oturum veya kripto kodumu yazmıyorum.** Plan §5'teki ölçütler: Prisma adaptörü, veritabanında oturumlar, e-posta/şifre girişi, şifre sıfırlama akışı, yerleşik CSRF/origin koruması, `HttpOnly` + `Secure` + `SameSite=Lax` çerez, şifre değişince bütün oturumların düşmesi. Kütüphane seçimini plan E-07 gereği bu ADR'de doğruladım ve 2026-10-28'de karara bağladım.

İhtiyacım dar: tek bir rol (admin), herkese açık kayıt yok, OAuth/SSO/2FA yok, salt okunur bir demo admin.

Doğruladığım gerçekler ([araştırma kaydı](../research/2026-10-28-teknoloji-dogrulamasi.md), bölüm 3):

- Better Auth 1.7.14 (2026-10-26) en güncel kararlı sürüm. Peer'leri `next ^16`, `react ^19`, Prisma 5–7. Dokümanı "Next.js 16 ile tam uyumlu" diyor.
- Vercel, Better Auth'u 2026-07-07'de satın aldı. MIT, isim ve açık katkı modeli sürüyor.
- Auth.js'in bakımı 2025-09'dan beri Better Auth ekibinde; yalnız güvenlik ve acil sorunlar için sürüyor. Yeni projelere Better Auth öneriliyor. v5 hâlâ beta.
- Lucia Mart 2025'te bırakıldı. Bugün bir öğrenme kaynağı; oturum kodunu kendim yazmamı gerektiriyor.
- Better Auth'ta rate limit varsayılan olarak bellekte ve geliştirmede kapalı. Şifre sıfırlamada diğer oturumlar varsayılan olarak düşmüyor. Sunucu tarafı `auth.api` çağrıları rate limit'e takılmıyor.

## Seçenekler

| Ölçüt | Better Auth 1.7.x | Auth.js (next-auth) | Lucia yaklaşımı |
|---|---|---|---|
| Bakım | Etkin: Ekim 2026'da altı yama sürümü; 30,5 bin yıldız; 2026-07'den beri Vercel bünyesinde, MIT | Better Auth ekibinde, yalnız güvenlik ve acil sorunlar; `latest` 4.24.15, v5 `5.0.0-beta.32` | Kütüphane Mart 2025'te bırakıldı; bakım bana kalır |
| Next.js 16 / React 19 | Dokümanda "tam uyumlu"; peer `next ^16`, `react ^19` | Doğrulamadım | Bana kalır |
| Prisma + Postgres'te DB oturumu | Resmi Prisma adaptörü; şema CLI ile üretilir, migration'ı Prisma uygular | `@auth/prisma-adapter` 2.11.3; Credentials ile DB oturumu doğrulanmadı | Kendim yazarım |
| E-posta/şifre ve hash | Yerleşik; scrypt; 8–128 karakter; `disableSignUp` | Credentials: hash ve rate limit uygulamaya kalıyor, şifre girişi önerilmiyor | Kendim yazarım |
| Şifre sıfırlama | Yerleşik; token 1 saat; `revokeSessionsOnPasswordReset` | Yerleşik değil | Kendim yazarım |
| Oturum iptali | `revokeSession`, `revokeOtherSessions`, `revokeSessions`; `changePassword({ revokeOtherSessions })` | Doğrulamadım | Kendim yazarım |
| Veritabanında rate limit | Yerleşik (`storage: "database"`) | Yok | Kendim yazarım |
| CSRF/origin | Origin kontrolü, Fetch Metadata ile giriş CSRF koruması, `SameSite=Lax`, yönlendirme adresi denetimi | Doğrulamadım | Kendim yazarım |
| Güvenlik geçmişi | 37 bildirim; çoğu kullanmayacağım eklentilerde; çekirdekte origin atlatma, açık yönlendirme, rate limit atlatma türleri; hepsi yamalandı | Taramadım | — |
| Plan §2 ile uyum | Uyumlu | Kısmen: şifre akışı ve rate limit benim kodum olur | Aykırı: kendi oturum kodum |

## Karar

**Better Auth (1.7.x, en az 1.7.14) kullanıyorum: yalnız çekirdek e-posta/şifre özelliği, resmi Prisma adaptörü, eklenti yok.**

Gerekçe: Plan §5'teki ölçütlerin hepsini yerleşik karşılayan tek seçenek bu: Prisma adaptörü, veritabanında oturum, e-posta/şifre, sıfırlama akışı, oturum iptali, veritabanında rate limit, origin/CSRF koruması ve güvenli çerez varsayılanları. Next.js 16 ve React 19 desteği peer bağımlılıklarında ve dokümanında açık. Auth.js'in bakımı zaten aynı ekibe geçti ve o ekip yeni projelere Better Auth'u öneriyor. Credentials yolu ise hash ve rate limit kodunu bana bırakıyor. Lucia yolu plan §2'ye aykırı. Bildirim sayısı yüksek ama bildirimler hızlı yamalanıyor ve büyük kısmı kullanmayacağım eklentilerde. Eklenti kullanmayarak saldırı yüzeyini küçük tutuyorum.

Zorunlu ayarlar (açıkça yazılır, varsayılana bırakılmaz):

| Ayar | Değer | Neden |
|---|---|---|
| `emailAndPassword.enabled` | `true` | Tek giriş yöntemi |
| `emailAndPassword.disableSignUp` | `true` | Herkese açık kayıt yok; ilk admin seed ile oluşur |
| `emailAndPassword.revokeSessionsOnPasswordReset` | `true` | Varsayılanı `false`; sıfırlamada bütün oturumlar düşer |
| `changePassword` çağrısında `revokeOtherSessions` | `true` | Şifre değişince diğer oturumlar düşer; ardından mevcut oturum da kapatılıp yeniden giriş istenir |
| `rateLimit.enabled` | `true` | Varsayılanı yalnız üretimde açık; geliştirmede ve testte de çalışsın |
| `rateLimit.storage` | `"database"` | Varsayılanı bellek; sunucusuz ortamda paylaşılmaz ([ADR 0004](0004-rate-limit.md)) |

Uyacağım kurallar:

1. `better-auth` ve `@better-auth/prisma-adapter` aynı tam sürüme sabitlenir. Güvenlik bildirimleri Dependabot uyarılarıyla izlenir; yüksek ve kritik bildirim aynı hafta yamalanır.
2. Eklenti kullanılmaz.
3. **Giriş ve şifre sıfırlama istekleri tarayıcıdan doğrudan `/api/auth/*` handler'ına gider.** Bu işler Server Action'dan ya da sunucu API'sinden (`auth.api.*`) yapılmaz; sunucu tarafı çağrılar rate limit'e takılmıyor.
4. Oturumlar veritabanında tutulur. `session.cookieCache` kapalı kalır; iptal edilen oturum hemen geçersiz olur.
5. `BETTER_AUTH_SECRET` ortam değişkeninden gelir ve açılışta zod ile doğrulanır. `trustedOrigins` yalnız sitenin kendi adresleri; üretimde `localhost` yok.
6. Çerezler kütüphane varsayılanıyla `HttpOnly`, `SameSite=Lax` ve https'te `Secure`. Üretimde `advanced.useSecureCookies: true` ile ayrıca zorlanır.
7. Yetki kontrolü her sayfada ve her handler'da `auth.api.getSession({ headers: await headers() })` ile yapılır. Proxy'deki `getSessionCookie` yalnız yönlendirme içindir ([ADR 0001](0001-mimari-nextjs-16-app-router.md)).
8. Demo modunda şifre değiştirme, sıfırlama ve kullanıcı güncelleme uçları sunucu tarafındaki tek demo korumasında reddedilir.
9. İlk admin seed betiğiyle, kütüphanenin kendi şifre hash fonksiyonu kullanılarak oluşturulur. Hangi API'yle yapılacağını Faz 4'te doğrularım.

## Sonuçlar

- Olumlu: `jose`, `bcrypt`, `cookie` ve kendi oturum kodum yeni koda girmiyor. G-05 (adres satırında token) ve G-09'un giriş/sıfırlama kısmı kütüphaneyle tekrarlanmıyor.
- Olumlu: Şema Better Auth CLI'ıyla üretiliyor, migration'ı Prisma uyguluyor. Tek migration hattı kalıyor.
- Olumsuz: Better Auth sık yama çıkarıyor. Bağımlılık güncellemesi rutin bir iş haline geliyor.
- Risk: Better Auth yalnız Prisma 5–7'yi destekliyor. Prisma 8'e geçiş Better Auth'un desteğine bağlı ([ADR 0002](0002-veri-ve-depolama.md)).
- **Risk: Better Auth 2026-07-07'den beri Vercel'in.** Yönetişim tek bir şirkette ve "Vercel'e kilitlenmez" ilkesine dokunuyor. Hafifletme:
  - Lisans MIT ve kütüphane çerçeveden bağımsız.
  - Adaptör modeli sayesinde kullanıcı, hesap ve oturum verisi Prisma şemasında, kendi Postgres tablolarımda duruyor.
  - Kütüphaneye yalnız `src/server/auth` modülü dokunuyor.

  Gerekirse aynı ölçüt tablosuyla başka bir kütüphaneye geçmek veriyi taşımayı değil, bu modülü yeniden yazmayı gerektirir.
- Zorunlu testler (gerçek Postgres'te, [ADR 0007](0007-test-stratejisi.md)):
  - Kayıt ucunun kapalı olduğu.
  - Yanlış şifre ve rate limit sınırı.
  - Eşzamanlı giriş denemelerinde sınırın aşılmadığı.
  - Şifre sıfırlamada ve değiştirmede bütün oturumların düştüğü.
  - Güvenilmeyen origin'den gelen isteğin reddedildiği.
  - Oturumsuz veya demo modunda yazma isteklerinin reddedildiği.

## Kaynaklar

- [Araştırma kaydı](../research/2026-10-28-teknoloji-dogrulamasi.md), bölüm 3
- https://github.com/better-auth/better-auth/releases
- https://registry.npmjs.org/better-auth/1.7.14
- https://www.better-auth.com/docs/integrations/next
- https://www.better-auth.com/docs/adapters/prisma
- https://www.better-auth.com/docs/authentication/email-password
- https://www.better-auth.com/docs/reference/options
- https://www.better-auth.com/docs/concepts/session-management
- https://www.better-auth.com/docs/concepts/rate-limit
- https://www.better-auth.com/docs/reference/security
- https://github.com/better-auth/better-auth/security/advisories
- https://vercel.com/blog/vercel-acquires-better-auth
- https://github.com/nextauthjs/next-auth/discussions/13252
- https://authjs.dev/getting-started/authentication/credentials
- https://lucia-auth.com/
