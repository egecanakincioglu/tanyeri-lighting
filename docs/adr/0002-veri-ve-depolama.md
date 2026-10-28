# ADR 0002: Veri ve depolama — Postgres (Neon), Prisma, Vercel Blob

Durum: Kabul edildi
Tarih: 2026-10-28

## Bağlam

Eski kodda veri üç yerde duruyordu. Biri MySQL'di; tablolar ham bir SQL betiğinden `$queryRawUnsafe` ile oluşturuluyordu (G-13). İkincisi JSON dosya veritabanlarıydı: `metadata`, `products`, `seo`, `firstLogin`, `pendingEmails`, `sql`. Bunlardan biri düz metin şifre (G-07), biri entegrasyon gizli bilgileri (G-06) içeriyordu. Üçüncüsü yerel diskteki `server/uploads/` klasörüydü; sunucusuz ortamda çalışmıyordu. Plan §2 kararım: **Postgres (Neon) + Prisma; dosyalar Vercel Blob'da.**

Doğruladığım gerçekler ([araştırma kaydı](../research/2026-10-28-teknoloji-dogrulamasi.md), bölüm 4, 5, 6):

- **Prisma 7'nin kararlı son sürümü 7.10.1.** `prisma` paketinin npm `latest` etiketi ise Prisma 8'in sürüm adayını (`8.0.0-rc.28`) gösteriyor. Prisma 8 baştan yazılıyor: CLI'ı `schema.prisma` okumuyor, `migrate dev` yok. Genel sürümü Ekim 2026'da bekleniyor. Prisma 7 o tarihten sonra 18 ay düzeltme alacak.
- Better Auth'un peer aralığı yalnız Prisma 5–7 ([ADR 0003](0003-kimlik-dogrulama.md)).
- Prisma 7'de her istemci bir sürücü adaptörü istiyor. Paket ESM; `prisma.config.ts` var; ortam değişkenleri otomatik yüklenmiyor; seed ve generate artık kendiliğinden çalışmıyor.
- Neon ile çalışma anında havuzlu `DATABASE_URL`, CLI ve migration için havuzsuz `DATABASE_URL_UNPOOLED` kullanılıyor. Vercel'in yönettiği Neon entegrasyonu bu değişkenleri kendisi ekliyor.
- Neon Free: proje başına ayda 100 CU-saat, 1 GB depolama, 10 dal; 5 dakikada uyku; ayda 5 GB çıkış trafiği. Aşımda compute askıya alınıyor ya da yazma duruyor, veri silinmiyor.
- Neon'un Vercel entegrasyonu her önizleme dağıtımına bir dal açabiliyor. Dallar Vercel dağıtımı silinince siliniyor ve varsayılan saklama 6 ay; Free'deki 10 dal sınırı dolabilir.
- Vercel Blob Hobby: 1 GB depolama, 10.000 basit ve 2.000 gelişmiş işlem, 10 GB aktarım. Aşımda 30 gün kullanılamıyor, ücret çıkmıyor.
- Vercel Functions'ta istek gövdesi sınırı 4,5 MB.
- Neon'da Postgres 18 2026-05-01'den beri genel kullanımda, Haziran 2026'dan beri yeni projelerde varsayılan.

## Seçenekler

| Alan | Seçenek | Artıları | Eksileri |
|---|---|---|---|
| Veritabanı | Postgres (Neon, Vercel Marketplace) | Standart Postgres, kilitlemez; ücretsiz plan; Vercel değişkenleri kendisi ekliyor | Uykudan uyanma gecikmesi; Free'de 10 dal ve 100 CU-saat |
| Veritabanı | MySQL'de kalmak | Mevcut şema | Vercel Marketplace'te değil, araştırmadım; ham SQL betiği ve `$queryRawUnsafe` kalır |
| ORM | Prisma 7 | Mevcut bağımlılık (5.22); migration'lar; Better Auth'un resmi adaptörü | ESM ve sürücü adaptörü geçişi; npm `latest` etiketi tuzağı |
| ORM | Prisma 8 (sürüm adayı) | Uzun vadede ana hat | Henüz aday; API değişebilir; Better Auth desteklemiyor; `migrate dev` yok |
| ORM | Drizzle veya Kysely | Hafif | Plan dışı; araştırmadım |
| Sürücü adaptörü | `@prisma/adapter-pg` | Aynı adaptör yerelde, CI'da ve Neon'da (havuzlu TCP) çalışır | Neon'a özgü sürücünün soğuk başlangıç avantajı yok |
| Sürücü adaptörü | `@prisma/adapter-neon` | Neon'un sunucusuz sürücüsü | Neon'a özgü; yerelde ve CI'da başka bir yol gerekir |
| Önizleme veritabanı | Bütün PR önizlemeleri için tek, paylaşılan bir Neon veritabanı | Dal sınırına takılmaz; üretimden ayrı; basit | Farklı PR'ların migration'ları aynı veritabanında buluşur |
| Önizleme veritabanı | Her önizleme dağıtımına bir Neon dalı | Tam yalıtım | Free'deki 10 dal sınırı dolabilir; temizlik Vercel'in saklama süresine bağlı |
| Dosyalar | Vercel Blob | Vercel'e entegre; ücretsiz kota; CDN | Vercel'e özgü API; Hobby kotası aşılırsa 30 gün kesinti |
| Dosyalar | S3 uyumlu harici depolama | Taşınabilir | Ek servis ve hesap; plan dışı |
| Yükleme yolu | Sunucudan (route handler / Server Action), 4 MB üst sınır | Doğrulama, yeniden kodlama ve meta veri temizliği tek istekte, sunucuda | 4,5 MB gövde sınırı yüzünden büyük dosya yok |
| Yükleme yolu | İstemciden doğrudan Blob'a | Büyük dosyalar | Dosya doğrulanmadan depoya girer; sonradan işleme ek adım ister |

## Karar

Plan §2'deki kararı olduğu gibi kaydediyorum: **Postgres (Neon), Prisma migration'ları, dosyalar Vercel Blob'da.** Araştırmanın çıkardığı uygulama kısıtlarını 2026-10-28'de karara bağladım; aşağıdaki kurallara dahil ettim.

Uyacağım kurallar:

1. **Prisma 7'ye tam sabitleme.** `prisma`, `@prisma/client` ve `@prisma/adapter-pg` aynı tam sürüme (bugün 7.10.1) sabitlenir, hiçbirinde aralık (`^`, `~`) yok.
   - npm'deki `latest` bir 8.x sürüm adayı olduğu için `prisma@latest` ve `npx prisma` hiçbir betikte sürümsüz kullanılmaz; CLI yalnız projedeki bağımlılıktan çalışır.
   - Dependabot'ta `prisma` ve `@prisma/*` için ana sürüm yükseltmesi yok sayılır.
   - Prisma 8'e geçiş ayrı bir ADR ister; ön koşulları Prisma 8'in genel sürümü ve Better Auth'un desteği.
2. **Sürücü adaptörü `@prisma/adapter-pg`.** Neon'a havuzlu TCP bağlantısıyla (`DATABASE_URL`) bağlanır; yerelde Docker'daki, CI'da servis konteynerindeki Postgres'le aynı adaptör kullanılır. Migration ve CLI işleri havuzsuz `DATABASE_URL_UNPOOLED` ile `prisma.config.ts` üzerinden yapılır.
3. Eski koddaki JSON dosya veritabanlarının karşılığı baştan Postgres tablolarında tasarlanır; eski veri taşınmaz. Ham SQL betiği ve `$queryRawUnsafe` yeni koda girmez (G-13). Ham sorgu gerekirse yalnız parametreli `$queryRaw`/`$executeRaw` kullanılır; Semgrep'in projeye özel kuralı `$queryRawUnsafe`'i yasaklar ([ADR 0008](0008-ci-ve-koruma-katmanlari.md)).
4. Şema değişikliği yalnız `prisma/migrations/` altındaki migration'larla yapılır. `db push` paylaşılan veritabanlarında kullanılmaz.
5. İlk admin `pnpm db:seed` ve ortam değişkenleriyle oluşur; kurulum sihirbazı yok (G-03, G-07).
6. Gizli entegrasyon bilgileri ortam değişkenlerinde durur. OAuth sonrası alınan refresh token veritabanında AES-GCM ile şifreli saklanır (G-06).
7. **Önizleme veritabanı:** bütün PR önizlemeleri tek, paylaşılan bir Neon önizleme veritabanını kullanır; bu veritabanı üretimden ayrıdır.
   - Önizleme başına Neon dalı açılmaz; entegrasyonun önizleme dalı özelliği kapalı tutulur.
   - Önizleme ortamının `DATABASE_URL`'i yalnız Preview ortamına tanımlanır. Önizleme dağıtımları üretim veritabanına hiçbir zaman bağlanmaz ve oraya migration uygulamaz.
8. **Dosya yükleme: yalnız sunucudan, en fazla 4 MB.**
   - Yükleme bir route handler ya da Server Action üzerinden gelir. Önce boyut sınırı uygulanır.
   - İçerik türü dosya adından veya `Content-Type`'tan değil, sihirli baytlardan belirlenir; izin listesinde olmayan tür reddedilir.
   - Görseller sharp ile yeniden kodlanır ve meta verisi temizlenir; ancak ondan sonra Vercel Blob'a yazılır.
   - İstemciden Blob'a doğrudan yükleme yok.
   - Blob erişimi `src/server/storage` arayüzünün arkasındadır ([ADR 0001](0001-mimari-nextjs-16-app-router.md), kilitlenmeme kuralı). Demo görselleri seed klasöründen yüklenir.
9. Testler gerçek Postgres'te çalışır: yerelde Docker Compose, CI'da servis konteyneri. Veritabanı taklit edilmez ([ADR 0007](0007-test-stratejisi.md)).

## Sonuçlar

- Olumlu: Tek bir Postgres veritabanı ve sürümlü migration'lar oluyor. Düz metin gizli bilgi ve şifre dosyaları ortadan kalkıyor.
- Olumlu: Neon standart Postgres. Prisma ve `adapter-pg` ile başka bir Postgres'e taşımak yalnız bağlantı adresini değiştirmek.
- Olumlu: Bütün dosyalar depoya yazılmadan önce sunucuda doğrulanıyor ve yeniden kodlanıyor; zararlı içerik ve EXIF gibi meta veriler depoya girmiyor.
- Olumsuz: Vercel Blob Vercel'e özgü. `src/server/storage` arayüzü sayesinde başka bir depolamaya geçiş tek bir adaptör yazmak demek.
- Olumsuz: 4 MB sınırı yüzünden büyük katalog PDF'leri yüklenemez. Demo kataloğu kısa ve küçük tutulur.
- Not: Prisma 7 ESM istediği için `package.json` baştan `"type": "module"`, `tsconfig` `moduleResolution: "bundler"` ile kurulur (plan Faz 3).
- Risk: Paylaşılan önizleme veritabanında farklı PR'ların migration'ları çakışabilir. Çakışırsa önizleme veritabanını sıfırlayıp yeniden seed'lerim; üretim etkilenmez.
- Risk: Hobby kotası aşılırsa Blob 30 gün, Neon compute dönem sonuna kadar duruyor. Demo bunu kaldırır ama README'de not edilir. Seed görselleri küçük tutulur (WebP, makul çözünürlük).
- Risk: Neon 5 dakikada uyuyor. İlk istekte bağlantı gecikmesi olur; bağlantı adresine `connect_timeout` eklenir. `adapter-pg`'nin soğuk başlangıç süresini Faz 9'da ölçerim.
- Postgres 18 üretimde (Neon), CI'da ve yerelde. CI imajı ve Neon projesi aynı ana sürümde kalır; ana sürüm yükseltmesi bilinçli bir PR'dır.
- Açık kalanlar (bu ADR'de karara bağlanmadı):
  - Migration'ların üretimde hangi adımda uygulanacağı: Vercel derlemesi mi, ayrı bir iş mi? Ön önerim derlemede `prisma migrate deploy` ve `DATABASE_URL_UNPOOLED`. Önizleme dağıtımları Faz 3'te başladığı için (plan §2, D4) Faz 3'te, önizlemeleri kurduğum PR'da karara bağlarım; üretim dağıtımı Faz 9'da açılır.
  - Önizleme veritabanına migration'ın nasıl uygulanacağı da aynı kararda ele alınır.
  - Blob mağazasının erişim türü (`public` veya `private`): ön önerim katalog içeriği için `public`. Faz 4'teki yükleme PR'ında karara bağlarım.
- Takip: Prisma 8 genel sürüme çıkınca ayrı bir ADR ile değerlendirilir.

## Kaynaklar

- [Araştırma kaydı](../research/2026-10-28-teknoloji-dogrulamasi.md), bölüm 4, 5, 6
- https://registry.npmjs.org/-/package/prisma/dist-tags
- https://github.com/prisma/prisma/releases
- https://www.prisma.io/docs/orm/release-status
- https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7
- https://www.prisma.io/docs/orm/prisma-client/deployment/serverless/deploy-to-vercel
- https://neon.com/docs/guides/prisma
- https://neon.com/docs/introduction/plans
- https://neon.com/docs/guides/vercel-managed-integration
- https://vercel.com/docs/vercel-blob/usage-and-pricing
- https://vercel.com/docs/vercel-blob/server-upload
- https://neon.com/docs/changelog/2026-05-01
- https://neon.com/docs/changelog/2026-06-05
