# Geliştirme ortamı

Bu rehber projeyi kendi makinemde nasıl kurup çalıştırdığımı anlatır. Git kuralları [git iş akışı rehberinde](git-workflow.md), sürüm ve kapsam kararları [planda](../plans/2026-10-27-revizyon.md) durur.

## Desteklenen ortamlar

- **Windows (ana geliştirme ortamım):** Git Bash ve PowerShell 5.1. Kurulum betikleri (`.sh`) Git Bash'te koşulur; Node araçları (`node tooling/scripts/...ts`) her iki kabukta da çalışır.
- **Linux:** Aynı komutlar. CI da Linux'ta (`ubuntu-latest`) koşar; Windows'ta da test edilen `tooling (windows)` işi vardır.
- **Node:** 24 (`.node-version`). `package.json` `engines` alanı `>=24.12.0 <25` ister. Node 24, `.ts` dosyalarını derlemeden çalıştırır. Bütün kod TypeScript'tir; düz JavaScript yazmam.
- **Paket yöneticisi:** pnpm 12.15.0, `package.json` içindeki `packageManager` alanıyla sabit. Sürüm Corepack üzerinden gelir; ayrıca pnpm kurmam.

## İlk kurulum

Bir kez, her klon için:

1. Repoyu klonlarım: `git clone <repo-adresi> tanyeri-lighting` ve klasöre girerim.
2. Corepack'i etkinleştiririm: `corepack enable`.
3. Bağımlılıkları kilit dosyasından kurarım: `pnpm install --frozen-lockfile`.
4. Git hook'larını kurarım: `bash tooling/scripts/setup-git-hooks.sh`. Betik `core.hooksPath`'i `tooling/git-hooks` yapar, `core.autocrlf`'i kapatır ve imza kurulumunu çağırır.
5. Ortamı denetlerim: `node tooling/scripts/doctor.ts`.

Commit imzası 4. adımdaki betikle birlikte kurulur (`tooling/scripts/setup-commit-signing.sh`); ayrıca bir şey çalıştırmam gerekmez. Commit'ler SSH anahtarıyla imzalanır. Git kimliğim (`user.email`) ayarlı olmalı; yoksa betik durur. Mevcut bir `user.signingkey` varsa korunur; yoksa `~/.ssh/tanyeri_signing_ed25519` anahtarı üretilir.

`doctor` her denetimi sırayla listeler ve her başarısız denetim için düzeltme komutunu gösterir. Hata varsa çıkış kodu 1 olur; uyarı (`warn`) çıkış kodunu değiştirmez. Makine okunabilir çıktı için `--json` eklerim. Denetimler: git kimliği, git hook'ları, commit imzası, satır sonları, gitleaks, pnpm ve yerel dışlamalar (`.git/info/exclude`).

## Docker

Docker, iki araç için gerekir ve ikisinin imajı da `tooling/ci-images/Dockerfile` dosyasındaki listeden okunur (tek kaynak; `node tooling/scripts/ci-image.ts <aşama>` imaj adını ve sabit özetini verir):

- **gitleaks:** Commit öncesi sır taraması, yerel gitleaks sürümü Dockerfile'daki sürümle aynıysa doğrudan o çalışır; değilse Docker (ya da Podman) daemon'u gerekir. Daemon yoksa commit reddedilir; sır taraması atlanmaz.
- **Semgrep:** Projeye özel kuralların testi ve taraması. CI'daki komutların aynısını yerelde Docker imajıyla koşarım:

```bash
image="$(node tooling/scripts/ci-image.ts semgrep)"
docker run --rm -v "$PWD:/src" -w /src "$image" semgrep --test --metrics=off tooling/semgrep
```

## Günlük komutlar

Hepsi `package.json` içindeki script'lerdir ve `pnpm <ad>` ile çalışır:

- `pnpm dev`: geliştirme sunucusunu (`next dev`) açar.
- `pnpm build`: üretim derlemesini (`next build`) alır.
- `pnpm start`: derlenmiş uygulamayı (`next start`) çalıştırır; önce `build` gerekir.
- `pnpm test`: Vitest'i kapsamla birlikte koşturur (`vitest run --coverage`).
- `pnpm lint`: ESLint'i `src`, `tooling` ve kök `.ts` dosyalarında, uyarı sıfır toleransıyla çalıştırır.
- `pnpm typecheck`: TypeScript denetimini hem uygulama hem tooling yapılandırmasıyla yapar (`tsc --noEmit`).
- `pnpm format`: Prettier ile dosyaları biçimlendirir (yazar).
- `pnpm format:check`: biçimlendirmeyi yalnız denetler; yazmaz. CI bunu koşar.
- `pnpm knip`: ölü kod ve kullanılmayan bağımlılıkları tarar.

Tooling betikleri (`node tooling/scripts/<ad>.ts`) ayrıca çalıştırılır; örneğin dokümanlar için `node tooling/scripts/check-docs-language.ts` ve `node tooling/scripts/check-doc-links.ts`.

## Gitleaks notları

- Sır taraması ayarı kökteki `.gitleaks.toml` dosyasındadır; gitleaks bunu tarandığı deponun kökünden kendiliğinden okur. Varsayılan kurallar açıktır; üstüne üç özel kural eklenmiştir: JSON/YAML benzeri alanlardaki parolalar, bağlantı adreslerindeki kimlik bilgileri ve Türkiye cep telefonu numaraları. Özel kurallar, varsayılan kuralların kaçırdığı gerçek bir veritabanı parolasına karşılık eklendi.
- Telefon kuralı kurgusal demo telefonlarını da yakalar. Bu yüzden içerikte kurgusal bir telefon geçerse satıra `gitleaks:allow` işareti ve aynı satırda "kurgusal" notu koyarım. Gerçek bir numara asla yazılmaz.
- Test verisinde sır benzeri bir değer gerekirse aynı işaret kullanılır (`// gitleaks:allow`); repodaki testler bu yolu kullanır.

## Eski kod rehberi (yalnız yerelde)

- `docs/old-source-code/` eski uygulamanın salt okunur kopyasıdır. Yalnız yerelde durur, repoya girmez: `.gitignore` onu dışarıda tutar ve yasak yol denetimi izlemesini engeller.
- Oradan dosya kopyalamam, değiştirmem, taşımam ya da silmem. Yalnız özellik ve içerik envanteri için okurum; proje sıfırdan yazılır.
- İçindeki `.env` dosyası hiç okunmaz.
- Faz 3'ten itibaren ESLint, Prettier, Vitest ve tsconfig bu klasörü açıkça dışlar.
- Yerel asistan yapılandırması ve yerel araç dosyaları da `.git/info/exclude` ile dışarıda tutulur; `doctor` bu dışlamaları denetler.
