# ADR 0008: CI ve koruma katmanları — GitHub'ın barındırdığı çalıştırıcılar, zorunlu kontroller, dal koruması, CodeQL, Semgrep, gitleaks, Dependabot

Durum: Kabul edildi; bir kısmı ADR 0009 ile değişti ("Lighthouse kapıları yok" ifadesi ve zorunlu kontrol listesi)
2026-10-28 güncellemesi: kurulum sırasında aynı gün netleşen ayrıntıları (zorunlu kontrol listesi, CodeQL'in zorunlu olması, gitleaks'in digest'li imajla çalışması, Dependabot ekosistemleri) uygulamaya geçmeden işledim; karar değişmedi.
Tarih: 2026-10-28

## Bağlam

Eski repo herkese açıktı ve geçmişinde bir veritabanı şifresi ile müşteri bilgileri vardı (G-01). Yeni repo temiz bir ilk commit'le başladı; eski geçmiş taşınmadı. Ön tarama varsayılan gitleaks kurallarının gerçek şifreyi yakalamadığını gösterdi (G-12). Eski kodun bağımlılıklarında 51 açık vardı (G-02).

Plan §2'deki kararlarım:

- CI çalıştırıcısı GitHub'ın barındırdığı çalıştırıcılar; kendi CI makinem, Lighthouse kapıları ve ağır iş kilitleri yok.
- PR'lar `--auto` ile kuyruğa alınır; zorunlu kontroller yeşil olunca GitHub birleştirir.

Plan §3 ve §4'te kurallar ve katmanlar belli:

- 5 zorunlu kontrol: `policy`, `pr-text`, `quality`, `test`, `build`.
- Dal koruması: PR zorunlu, strict, imzalı commit, force push ve silme kapalı, yöneticiler dahil.
- Yalnız merge commit; dal otomatik silinir.
- Yalnız GitHub'ın ve doğrulanmış yayıncıların action'ları; bütün action'lar tam commit SHA'sıyla sabit.
- Secret scanning + push protection.
- CodeQL.
- Semgrep.
- `.gitleaks.toml` özel kurallarla.
- Dependabot: npm ve GitHub Actions; haftalık, minor/patch gruplu.

Doğruladığım gerçekler ([araştırma kaydı](../research/2026-10-28-teknoloji-dogrulamasi.md), bölüm 12, 13, 14):

- **Çalıştırıcılar:** herkese açık repolarda standart GitHub çalıştırıcıları ücretsiz ve sınırsız (`ubuntu-latest`: 4 CPU, 16 GB RAM). Büyük çalıştırıcılar her zaman ücretli. Ubuntu çalıştırıcılarında Postgres servis konteyneri kullanılabiliyor.
- **CodeQL:**
  - Code scanning ve secret scanning (push protection dahil) herkese açık repoda ücretli ürün gerektirmiyor.
  - CodeQL lisansı, GitHub.com'da barındırılan ve OSI onaylı lisansla yayımlanan kodda CI kullanımına izin veriyor.
  - CodeQL JavaScript/TypeScript'i (React dahil) ve GitHub Actions iş akışlarını tarıyor.
  - Varsayılan kurulum ile repodaki iş akışı (gelişmiş kurulum) birlikte çalışmıyor.
  - `github/codeql-action` son sürümü v4.39.1.
- **Semgrep:**
  - Semgrep CE motoru LGPL-2.1, son sürümü v1.182.0; hesap gerektirmeden çalışıyor.
  - Hazır registry kuralları "Semgrep Rules License v1.0" ile geliyor: kullanım "kendi iç iş amaçlarına" sınırlı, dağıtmak yasak. Herkese açık bir projenin CI'ı açıkça ele alınmamış.
  - CE kapsamı ince: hesapsız istemcide `p/react` 4 kural, `p/nextjs` boş (0 kural).
- **gitleaks:**
  - gitleaks v8.30.1, MIT.
  - **gitleaks-action v2'den beri MIT değil** (Gitleaks LLC son kullanıcı sözleşmesi) ve Marketplace'te onaylı yayıncı değil. **pnpm/action-setup da onaylı yayıncı değil.**
- **Paket yöneticisi:** Corepack Node 24'te var (deneysel), Node 25'ten itibaren dağıtılmıyor. pnpm `latest` 12.15.0.
- **Dependabot:** güvenlik güncellemeleri bütün repolarda var; herkese açık repolarda uyarılar varsayılan açık; güncellemeler ekosistem başına gruplanabiliyor.

## Seçenekler

| Alan | Seçenek | Artıları | Eksileri |
|---|---|---|---|
| Çalıştırıcı | GitHub'ın barındırdığı standart çalıştırıcı | Herkese açık repoda ücretsiz ve sınırsız; bakım yok; servis konteyneri var | Kaynaklar sabit; sıra beklenebilir |
| Çalıştırıcı | Kendi CI makinem | Hızlı, önbellek kalıcı | Bakım ve güvenlik yükü; herkese açık repoda fork PR'larından kod çalıştırma riski; plan §2'ye aykırı |
| SAST | CodeQL (`security-extended`) ana tarayıcı + Semgrep yalnız projeye özel kurallarla | Lisans temiz (CodeQL açık kaynak koda izinli, özel kurallar MIT ve benim); CodeQL'in veri akışı analizi; proje kuralları her zaman çalışır | Registry'deki hazır desenlerden yararlanılmaz |
| SAST | CodeQL + Semgrep registry setleri + özel kurallar | Daha fazla hazır desen | Kural lisansı herkese açık CI için belirsiz; CE kapsamı ince (`p/nextjs` boş, `p/react` 4 kural); yeni bulgu ayıklaması için ek adım |
| SAST | Yalnız CodeQL varsayılan kurulumu | Sıfır bakım | Repoda iz yok; SHA sabitleme kuralının dışında; projeye özel kural yok |
| Sır taraması | gitleaks ikili dosyası (MIT), sağlama toplamıyla | Lisans temiz; sürüm sabit; aynı komut yerelde ve CI'da | İndirme ve doğrulama adımını kendim yazarım |
| Sır taraması | gitleaks-action | Hazır | MIT değil; onaylı yayıncı değil; plan §4'teki action kısıtına takılır |
| pnpm kurulumu | Corepack (`packageManager` alanı, hash'li) | Üçüncü taraf action yok; sürüm ve bütünlük `package.json`'da | Node 24'te deneysel; Node 25'ten itibaren ayrıca kurulması gerekiyor |
| pnpm kurulumu | pnpm/action-setup | Hazır | Onaylı yayıncı değil; plan §4'teki kısıta takılır |

## Karar

Plan §2, §3 ve §4'teki kararı kaydediyorum: **GitHub'ın barındırdığı çalıştırıcılar; zorunlu kontroller; dal koruması; CodeQL; Semgrep; gitleaks; Dependabot.** SAST'ın biçimini, gitleaks ve pnpm kurulumunu 2026-10-28'de karara bağladım. Semgrep'te hazır kural setlerini kullanmıyorum; bu karar plan §4'teki ve Faz 3'teki "hazır güvenlik kural setleri" ifadesinin yerini alıyor ve plan dosyasını buna göre güncellerim.

Uyacağım kurallar:

1. **İş akışları:** `.github/workflows/ci.yml` (`policy`, `tooling (linux)`, `tooling (windows)`; Faz 3'te `quality`, `test`, `build`), `.github/workflows/pr-text.yml` (`pr-text`) ve `.github/workflows/codeql.yml` (`analyze (javascript-typescript)`). İş adları zorunlu kontrol adlarıyla birebir aynı. `tooling (windows)` dışında hepsi `ubuntu-latest` standart çalıştırıcıda; büyük çalıştırıcı kullanılmaz.
2. **İşlerin içeriği** (plan §4):
   - `policy`: dal adı; PR'daki her commit (başlık, gövde, yasaklı terim, imza); günlük satırı; testsiz kod kapısı ve kapsam eşiğinin düşürülmemesi ([ADR 0007](0007-test-stratejisi.md)); bütün geçmişte sır taraması; yasak yollar.
   - `pr-text`: PR başlığı, yasaklı terimler, roadmap satırı.
   - `quality`: Prettier, ESLint CLI (flat config; `next lint` yok), `tsc --noEmit` (uygulama ve `tooling/` birlikte; plan §2, D5), ölü kod ve kullanılmayan bağımlılık taraması, `pnpm audit` (high/critical kırmızı, süreli istisna listesi), Semgrep, lisans politikası.
   - `test`: Vitest, Postgres servis konteyneriyle ve kapsam eşiğiyle.
   - `build`: `next build`.
3. **Dal koruması (`main`):** PR zorunlu (0 onay); zorunlu kontroller `policy`, `pr-text`, `tooling (linux)`, `tooling (windows)`, `analyze (javascript-typescript)` ve `CodeQL`, Faz 3'ten sonra `quality`, `test`, `build`; strict (dal güncel olmalı); imzalı commit zorunlu; force push ve dal silme kapalı; yöneticiler dahil. Repo ayarları: yalnız merge commit, dal otomatik silme, auto-merge açık, dal güncelleme önerisi açık.
4. **Action'lar:** yalnız GitHub'ın (`actions/*`, `github/*`) ve doğrulanmış yayıncıların action'ları; her biri tam commit SHA'sıyla, yanında sürüm yorumu. Doğrulanmış olmayan araçlar action olarak değil, sürümü ve bütünlüğü sabit ikili dosya ya da paket olarak çalıştırılır.
5. **CodeQL ana SAST tarayıcısı:** repoda bir iş akışıyla (gelişmiş kurulum).
   - Sorgu seti `security-extended`; diller `javascript-typescript` ve `actions`.
   - `main`'e push'ta, `main`'e açılan PR'larda ve haftalık çalışır. Bulgular güvenlik sekmesinde görünür.
   - CodeQL'in `analyze (javascript-typescript)` işi ve `CodeQL` sonuç kontrolü zorunlu kontrollerdendir.
   - CodeQL lisansı OSI onaylı lisans istediği için `LICENSE` (MIT) dosyası CodeQL iş akışıyla birlikte ya da ondan önce repoda olur.
6. **Semgrep yalnız projeye özel kurallarla çalışır**; registry'den hiçbir kural seti çekilmez. Kurallar repoda (MIT) durur ve her PR'da bütün kod üzerinde çalışır; bulgu `quality` işini kırar.
   - `$queryRawUnsafe` / `$executeRawUnsafe` kullanımı.
   - `dangerouslySetInnerHTML`.
   - `eval` ve `new Function`.
   - Ortam modülü (`src/server/env`) dışından `process.env` erişimi.
   - Kaynak kodda sabit gizli bilgi (anahtar, token, şifre değişkenine dizgi atanması).

   Her kuralın kendi pozitif ve negatif örnek testi olur (`semgrep --test`). Motor CE, sabit sürüm (CI imaj listesindeki digest'li sürüm), resmi konteyner imajı digest ile sabit; Semgrep hesabı veya token kullanılmaz.

   **Neden hazır setler yok:** (1) kural lisansı kullanımı "kendi iç iş amaçlarına" sınırlıyor ve herkese açık bir projenin CI'ını açıkça ele almıyor; (2) CE kapsamı bu yığın için ince (`p/nextjs` boş, `p/react` 4 kural). Genel güvenlik desenlerini CodeQL'in `security-extended` seti karşılıyor.
7. **gitleaks:** v8.30.1, resmi konteyner imajıyla ve digest ile sabit (`tooling/ci-images/Dockerfile`; Dependabot günceller). Yerelde PATH'te kurulu bir `gitleaks` varsa o kullanılır. Varsayılan kurallar ve `.gitleaks.toml`'daki özel kurallarla çalışır: JSON/YAML içindeki şifre alanları, bağlantı adreslerindeki kimlik bilgisi, Türkiye telefon numarası. Hem staged değişiklikte (yerel hook) hem bütün geçmişte (CI `policy`) çalışır. Bilinen yanlış pozitif parmak iziyle istisna listesinde durur. Yerel hook PATH'teki `gitleaks`'i yalnız sabitlenen sürümdeyse kullanır; değilse sabitlenen imajı Docker ya da Podman'la çalıştırır; ikisi de yoksa commit'i reddeder (tarama hiç atlanmaz). Doctor aynı denetimi yapar.
8. **pnpm Corepack ile kurulur.** `package.json`'daki `packageManager` alanı pnpm'in tam sürümünü ve bütünlük hash'ini taşır; CI'da `corepack enable` sonrası bu sürüm kullanılır. `policy` alanın hash'li ve tam sürümlü olduğunu denetler.
9. **Dependabot:** `npm`, `github-actions` ve `docker` (CI imaj listesi) ekosistemleri; haftalık; minor ve patch güncellemeleri ekosistem başına gruplu; yeni sürümler 7 gün bekler, güvenlik güncellemeleri beklemez; `prisma` ve `@prisma/*` ile Postgres imajının ana sürümleri yok sayılır (ana sürüm geçişi bilinçli bir PR); güvenlik güncellemeleri ve uyarıları açık. Dependabot PR'ları da aynı zorunlu kontrollerden geçer.
10. **Repo güvenlik ayarları:** secret scanning ve push protection açık; gizli güvenlik açığı bildirimi açık. Actions: SHA sabitleme zorunlu, iş akışı token'ı salt okunur, Actions PR onaylayamaz.

## Sonuçlar

- Olumlu: Çalıştırıcılar, code scanning, secret scanning ve Dependabot bu repo için ücretsiz. Ek servis ya da hesap gerekmiyor.
- Olumlu: Bütün koruma araçları (gitleaks, Semgrep CE, CodeQL iş akışı) sürümleri sabit ve repoda görünür. Aynı komutlar yerelde de çalışır.
- Olumlu: SAST'ta lisans belirsizliği kalmıyor. Semgrep kuralları benim, CodeQL'in açık kaynak kullanımı lisansında açık.
- Olumsuz: Plan §4'teki action kısıtı yüzünden gitleaks ve pnpm kurulum adımlarını kendim yazıyorum. Bu adımların doğrulaması (sağlama toplamı, sürüm ve hash eşleşmesi) testli betiklerde olur.
- Olumsuz: Registry'deki hazır Semgrep desenleri kullanılmıyor. Next.js'e özgü güvenlik desenleri yalnız kendi kurallarımla ve CodeQL'le aranıyor.
- Risk: Corepack Node 24'te deneysel ve Node 25'ten itibaren Node ile gelmiyor. Node 26'ya geçişte Corepack, sabit sürümlü npm paketi olarak ayrıca kurulur.
- Risk: Strict dal koruması her birleştirmeden önce dalın güncel olmasını istiyor. Aynı anda birden fazla PR kuyruktayken auto-merge sırayla yeniden çalıştırma gerektirebilir; tek kişilik bir projede kabul edilebilir.
- Takip: Korumaları 2026-10-28'de açtım; sonraki ilk PR (#8) zorunlu kontrollerden geçip auto-merge ile birleşti. `quality`, `test` ve `build` Faz 3'te kurulup zorunlu kontrollere eklenir.

## Kaynaklar

- [Araştırma kaydı](../research/2026-10-28-teknoloji-dogrulamasi.md), bölüm 12, 13, 14
- https://docs.github.com/en/actions/reference/runners/github-hosted-runners
- https://docs.github.com/en/billing/concepts/product-billing/github-actions
- https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers
- https://docs.github.com/en/get-started/learning-about-github/about-github-advanced-security
- https://docs.github.com/en/code-security/concepts/code-scanning/setup-types
- https://github.com/github/codeql-cli-binaries/blob/main/LICENSE.md
- https://codeql.github.com/docs/codeql-overview/supported-languages-and-frameworks/
- https://github.com/github/codeql-action/releases
- https://docs.semgrep.dev/licensing
- https://semgrep.dev/legal/rules-license
- https://docs.semgrep.dev/cli-reference
- https://github.com/semgrep/semgrep/releases
- https://github.com/gitleaks/gitleaks/releases
- https://github.com/gitleaks/gitleaks-action/blob/master/LICENSE.txt
- https://github.com/marketplace/actions/gitleaks
- https://github.com/marketplace/actions/setup-pnpm
- https://nodejs.org/docs/latest-v24.x/api/corepack.html
- https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-security-updates
