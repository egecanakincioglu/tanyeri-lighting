# ADR 0011: Sürümleme ve yayın — SemVer, etiketle canlıya dağıtım, sürüm provası

Durum: Kabul edildi
Tarih: 2026-10-28

## Bağlam

Plan §2'deki D4 kararıyla Vercel her PR için önizleme derliyordu ve `main` Faz 9'a kadar üretime dağıtılmayacaktı; Faz 9'da `main`'in her birleşmesi canlıya gidecekti. İki sorun gördüm:

- `main`'e birleşen her iş canlıya gitmemeli. Neyin ne zaman yayımlanacağına ben karar vermek istiyorum; yayımlanan şeyin de bir sürüm numarası olmalı.
- Her PR'ın her push'u bir Vercel derlemesi demek. Doküman, CI ve tooling PR'larında bu derlemeler boşuna; Hobby'nin derleme kotasını Flareye'yle paylaşıyorum.

Önizlemeleri tamamen kaldırırsam migration'lar ve Vercel'e özgü sorunlar (ortam değişkenleri, bölge, sunucusuz sınırlar, `sharp`, başlıklar) ilk kez canlıda görülür. Veriyi bozan bir migration'ın geri dönüşü yok.

## Seçenekler

| Seçenek | Artıları | Eksileri | Sonuç |
|---|---|---|---|
| `main` → canlı, PR önizlemeleri (D4) | Kurulumu yok | Her birleşme canlıya gider; sürüm yok; en çok derleme | Elendi |
| Sürüm etiketi → GitHub Actions → Vercel CLI | Yalnız sürüm canlıya gider; derleme sayısı en az; Vercel'in Git entegrasyonuna bağlı değil | Vercel token'ı repo secret'ı olarak gerekir | Seçildi |
| Ayrı `release` dalı Vercel'in üretim dalı olur | Token gerekmez | İkinci korumalı dalı yönetmek; sürüm ile dal ayrı ayrı ilerler | Elendi |
| PR önizlemeleri yalnız arayüz PR'larında | Arayüzü gerçek ortamda görmek | Yine de PR başına derleme | Elendi |
| Önizleme hiç yok | En az derleme | Migration ve platform sorunları ilk kez canlıda | Elendi |
| Yalnız sürüm provası | Sürüm başına bir prova derlemesi; migration ve platform canlıdan önce sınanır | Arayüzü PR sırasında gerçek ortamda göremem (yerelde ve `site-audit`'te görürüm) | Seçildi |

## Karar

**Semantic Versioning 2.0.0 ile çalışıyorum. Canlıya yalnız sürüm etiketi dağıtılır; her sürümden önce bir kez önizleme ortamında prova yapılır.**

Uyacağım kurallar:

1. **Sürüm numarası `MAJOR.MINOR.PATCH`.** Sürüm `package.json`'daki `version` alanıdır; etiket `vX.Y.Z`.
   - `fix` → PATCH (hata düzeltmesi, acil düzeltme).
   - `feat` → MINOR (yeni özellik, küçük de olsa).
   - Geriye uyumsuz değişiklik (`BREAKING CHANGE`) → MAJOR. 1.0.0'dan önce MINOR artar.
   - `docs`, `chore`, `ci`, `test`, `build`, `refactor`, `style`, `perf` tek başına sürüm gerektirmez; o sürümün değişiklik listesinde yer alır.
2. **0.x dönemi.** 1.0.0 plandaki Faz 9'dur (yayın). Ondan önceki her anlamlı aşama bir 0.x sürümüdür. İlk sürüm v0.1.0: Faz 3'ün kapanışı.
3. **Sürüm akışı.**
   1. Ne zaman sürüm çıkılacağına ben karar veririm; `main`'e birleşen işler kendiliğinden yayımlanmaz.
   2. Sürüm PR'ı (`chore(release): vX.Y.Z`): `package.json` sürümü ve `CHANGELOG.md`'nin yeni bölümü. Bölüm son etiketten bu yana birleşen commit'lerden tipe göre derlenir; bir sonraki numarayı ve taslağı tooling betiği önerir.
   3. Sürüm provası: sürüm PR'ının dalı elle tetiklenen iş akışıyla Vercel'in önizleme ortamına dağıtılır. Önizleme derlemesi migration'ları önizleme veritabanına uygular. Sayfaları ve migration'ı kontrol ederim.
   4. Sürüm PR'ı birleşir; birleşme commit'ine imzalı etiket (`git tag -s vX.Y.Z`) atılıp push'lanır.
   5. Etiket iş akışı: etiketin `main` üzerindeki bir commit'i gösterdiğini ve `package.json` sürümüyle aynı olduğunu denetler; Vercel CLI ile üretime dağıtır; `CHANGELOG.md`'deki bölümle GitHub Release açar.
4. **Vercel'in Git entegrasyonu dağıtım yapmaz.** `vercel.json`'da `git.deploymentEnabled: false`; bütün dağıtımlar GitHub Actions'tan, Vercel CLI ile (tam sürüm, `devDependencies`'te) yapılır. Derleme Vercel'de, ortamın kendi değişkenleriyle olur.
5. **Migration'lar.** Derleme betiği (`tooling/scripts/vercel-build.ts`) önizlemede ve üretimde `prisma migrate deploy` çalıştırır, sonra `next build`. Üretim derlemesi artık yalnız sürüm etiketinden geldiği için üretim migration'ı sürümle birlikte uygulanır; önizleme veritabanında provası yapılmış olur. ADR 0002 kural 7'deki ortak önizleme veritabanı yalnız sürüm provası için kullanılır.
6. **Dizine girme.** Canlı site 1.0.0'a kadar arama motorlarına kapalıdır (`noindex`). Açıp kapamak tek bir ortam değişkeniyle olur; 1.0.0 sürümünde açarım. ADR 0009'daki "üretim dizine girer" kuralı 1.0.0'dan itibaren geçerlidir.
7. **Geri dönüş.** Canlıda sorun çıkarsa Vercel'de bir önceki üretim dağıtımına dönerim; düzeltme yeni bir PATCH sürümüyle gelir. Migration'lar ileriye doğrudur; veri silen migration ayrı bir sürümde ve provada doğrulanarak çıkar.
8. **Denetimler.**
   - `policy`: `version`'ı değiştiren PR `CHANGELOG.md`'yi de değiştirir ve sürüm yalnız artar.
   - Etiket iş akışı: etiket–sürüm eşitliği ve `main` üzerinde olma.
   - Yayın iş akışları CodeQL'in `actions` taramasından ve actionlint'ten geçer; action'lar SHA ile sabittir.
9. **Elle yapacaklarım.** Vercel'de takım kapsamlı bir token oluşturup `VERCEL_TOKEN` repo secret'ı olarak eklemek; takım ve proje kimliklerini repo değişkeni (`VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`) olarak eklemek. Token'ın süresi dolunca yenilemek sır yenileme runbook'una girer.

## Sonuçlar

- Olumlu: Canlıda ne olduğu her an bir sürüm numarasıyla belli; değişiklik listesi ve GitHub Release otomatik.
- Olumlu: Vercel derlemesi sürüm başına iki tane (prova ve canlı); PR'lar Vercel kotası harcamaz.
- Olumlu: Migration'lar ve platforma özgü sorunlar canlıdan önce önizleme ortamında görülür.
- Olumsuz: Arayüz PR'larını birleştirmeden önce gerçek Vercel ortamında göremem; yerelde ve `site-audit`'te kontrol ederim, gerçek ortamı provada görürüm.
- Olumsuz: Vercel token'ı yeni bir sır; repo secret'ı olarak durur ve süresi dolunca yenilenir.
- Değişen yerler: ADR 0002 (kural 7, önizleme veritabanının kullanımı) ve ADR 0009 (dizine girme 1.0.0'dan itibaren) durum satırları; plan D4, §5 dağıtım maddesi, Faz 9 maddeleri; `vercel.json`.

## Kaynaklar

- [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html)
- [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
- [ADR 0002: Veri ve depolama](0002-veri-ve-depolama.md)
- [ADR 0009: Kalite hedefleri](0009-kalite-hedefleri.md)
