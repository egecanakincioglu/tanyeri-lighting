# ADR 0009: Kalite hedefleri — SEO, yapay zekâ aramasında görünürlük, erişilebilirlik, performans, ajan erişimi ve her cihazda duyarlı tasarım

Durum: Kabul edildi; bir kısmı [ADR 0010](0010-kalite-esikleri.md) ve [ADR 0011](0011-surumleme-ve-yayin.md) ile değişti
Tarih: 2026-10-28

## Bağlam

Plan §2'de "Lighthouse kapıları yok" demiştim. 2026-10-28'de hedefimi değiştirdim: proje şu katmanların hepsinde tam puanı ölçülebilir biçimde göstermeli:

- SEO.
- GEO: yapay zekâ arama ve yanıt motorlarında görünürlük ve doğru kaynak gösterimi.
- Erişilebilirlik.
- Performans.
- Ajan katmanı: yapay zekâ ajanları siteyi okuyabilmeli, anlayabilmeli ve kullanabilmeli (gezinme, ürün bulma, iletişim formunu gönderme).
- Duyarlı tasarım: telefonda, tablette ve masaüstünde kusursuz görünüm.

"Tam puan" bir araçla ölçülmez ve CI'ı kırmazsa iddia olarak kalır. Bu ADR her katman için ölçütü, aracı, ölçüm yerini ve kapıyı belirliyor.

Kısıtlarım:

- Nonce'lu CSP yüzünden bütün sayfalar dinamik render ediliyor; statik üretim, ISR ve Cache Components yok ([ADR 0001](0001-mimari-nextjs-16-app-router.md)).
- `/tr` ve `/en` her zaman önekli, adresler her dilde kendi dilinde; kök `/` `Accept-Language`'a göre yönlendiriliyor ([ADR 0006](0006-cok-dillilik-next-intl.md)).
- Testlerde tarayıcı aracı yok ([ADR 0007](0007-test-stratejisi.md)).
- CI yalnız GitHub'ın çalıştırıcılarında; action'lar yalnız GitHub'ın ve doğrulanmış yayıncıların, SHA ile sabit ([ADR 0008](0008-ci-ve-koruma-katmanlari.md)).
- `dangerouslySetInnerHTML` Semgrep kuralımla yasak; JSON-LD'nin yolu açık soruydu (plan §10, S-09).
- Demo Vercel Hobby'de; önizleme dağıtımları korumalı ve `noindex`.
- [Tasarım incelemem](../research/2026-10-28-tasarim-incelemesi.md) eski sitenin en büyük eksiğini ilk ekranda buldu: metin ve eylem yok (T-01–T-03); düzeltmesi banner'a değer önermesi olan bir `h1` ve iki eylem (DZ-01).

Doğruladığım gerçekler ([araştırma kaydı](../research/2026-10-28-kalite-hedefleri.md)):

- Lighthouse'un son sürümü 13.6.0 (2026-10-27). Beş kategorisi var: performans, erişilebilirlik, en iyi uygulamalar, SEO ve deneysel "Agentic Browsing". Sonuncusu 0–100 puan değil, geçen denetim oranı gösteriyor. WebMCP, `llms.txt` ve ARD denetimleri dosya ya da API yoksa "uygulanamaz" sayılıyor ve oranı düşürmüyor; bunu kaynak kodunda gördüm.
- Lighthouse'un erişilebilirlik kategorisi axe-core'u yalnız `wcag2a` ve `wcag2aa` etiketleriyle ve bazı kuralları kapalı çalıştırıyor; WCAG 2.1 ve 2.2 AA'nın tamamını kapsamıyor. Deque'nin raporuna göre otomatik denetim sorunların yaklaşık %57'sini buluyor.
- Lighthouse CI'ın son sürümü 0.15.1 (2025-06) ve Lighthouse 12.6.1'e sabit; ajan kategorisi yok.
- Google'ın 2026 rehberine göre yapay zekâ özellikleri için ek koşul yok; bu hâlâ SEO. Görünmek için sayfanın dizinde olması gerekiyor. Google Arama `llms.txt` kullanmıyor. Yapılandırılmış veri yapay zekâ özellikleri için zorunlu değil, zengin sonuçlar için öneriliyor.
- Büyük yapay zekâ tarayıcılarının çoğu JavaScript çalıştırmıyor (Vercel'in 2024-12 analizi); içerik sunucunun gönderdiği HTML'de olmalı.
- WebMCP önerilen bir standart; Chrome'da kaynak denemesi (origin trial) aşamasında.
- Next.js 16'nın derleme çıktısında paket boyutları yok; JavaScript bütçesini Lighthouse'un kaynak özetinden ölçmem gerekiyor.
- Kendi makinemde denedim (Windows, Chrome 156, Next.js 16.4.3, React 19.3.1, next-intl 4.14.9, Lighthouse 13.6.0, nonce'lu CSP, yerel `next start`):
  - LCP öğesi metin olan sayfa: mobil ve masaüstü performans 100, erişilebilirlik 100, SEO 100, ajan kategorisi tam. JavaScript aktarımı 150 KB (7 istek).
  - Aynı sayfada LCP öğesi görsel (6 KB, `preload` ve `fetchPriority="high"`): mobil performans 98–99, LCP 2,04–2,13 s; masaüstünde 100. Fark görselin boyutundan değil: Lighthouse'un benzetimi LCP'ye çatının JavaScript'ini de katıyor.
  - `style-src`'de nonce varken `next/image`'ın satır içi `style` niteliği engellendi. Konsol hatası yüzünden en iyi uygulamalar 88–92'ye düştü; görsel 1600 px genişlikte kaldı ve 1616 px'in altındaki her genişlikte yatay taşma oldu. Performans, erişilebilirlik ve SEO 100'dü; axe de bir şey bulmadı. Sorunu yalnız konsol hatası ve taşma denetimi yakaladı.
  - JSON-LD'yi `<script type="application/ld+json">` öğesine metin çocuğu olarak yazdığımda React 19.3'ün sunucu render'ı `<script` ve `</script` dizilerini kaçırdı. `dangerouslySetInnerHTML` gerekmedi, CSP hatası olmadı; en iyi uygulamalar ve SEO 100 kaldı. HTML standardına göre veri blokları CSP denetimine hiç girmiyor.

## Değerlendirilen seçenekler

Nerede ölçülür:

| Seçenek | Artıları | Eksileri | Sonuç |
|---|---|---|---|
| CI'da yerel üretim derlemesi (`next build` + `next start`, Postgres servis konteyneri, demo seed'i) | Aynı commit ölçülür; Vercel'den bağımsız; önizleme koruması ve `noindex` yok; ağ gürültüsü yok; yerelde aynı komut çalışır | Üretimdeki soğuk başlangıcı ve bölge gecikmesini ölçmez | Seçildi |
| Vercel önizleme adresi | Gerçek platform | Önizlemeler korumalı ve `X-Robots-Tag: noindex` (SEO puanı düşer); dağıtımı beklemek gerekir; fork PR'larında dağıtım onay ister; ağ ve soğuk başlangıç gürültüsü; Vercel'e bağımlılık | Elendi |
| PageSpeed Insights API | Google'ın kendi ölçümü | Herkese açık adres ister; gürültülü; zorunlu kontrol olamaz | Yalnız Faz 9'da üretim ölçümü için |

Hangi araçla:

| Seçenek | Artıları | Eksileri | Sonuç |
|---|---|---|---|
| Lighthouse 13.6 (Node API ya da CLI), puppeteer-core ve axe-core ile küçük, testli bir betik | Güncel Lighthouse ve ajan kategorisi; puppeteer-core zaten Lighthouse'un bağımlılığı; WCAG 2.2 AA etiketlerinin tamamı; taşma, dokunma hedefi ve konsol aynı tarayıcıda | Medyan ve eşik mantığını kendim yazar ve test ederim | Seçildi |
| Lighthouse CI (`@lhci/cli`) | Hazır toplama ve doğrulama | 2025-06'dan beri sürüm yok; Lighthouse 12.6.1'e sabit; ajan kategorisi yok; axe ve taşma denetimi yine ayrıca gerekir | Elendi |
| Tarayıcı indiren bir uçtan uca test çatısı ve onun axe eklentisi | Tam kullanıcı akışı testleri | Büyük bağımlılık ve bakım; ADR 0007'yi tamamen tersine çevirir; ihtiyacım akış testi değil, sayfa denetimi | Elendi |

Mobil performans kapısı:

| Seçenek | Artıları | Eksileri | Sonuç |
|---|---|---|---|
| Kesin 100; mobilde ilk ekran metinle açılır | Tam puan baştan ve her sayfada kanıtlanır; tasarım incelemesinin ilk ekran düzeltmesiyle aynı yönde | Mobilde görsel hiçbir şablonda LCP öğesi olamaz; koşular arası oynamaya karşı pay dar | Seçildi |
| En az 98, yalnız yükselen eşik | Tasarım serbest; gürültüye dayanıklı | Bazı sayfalar mobilde 98–99 gösterebilir; tam puan iddiası ertelenir | Elendi |

CSP'de `style-src`:

| Seçenek | Artıları | Eksileri | Sonuç |
|---|---|---|---|
| `style-src 'self' 'unsafe-inline'` | `next/image` ve React'in stil nitelikleri çalışır; script kuralı aynı sıkılıkta kalır | CSS enjeksiyonu kuramsal olarak açık; önce HTML enjeksiyonu gerekir | Seçildi |
| Nonce, `'unsafe-hashes'` ve sabit hash'ler; `style` özelliği yasak | Daha sıkı | `next/image`'ın her stil dizgisi için ayrı hash; Next.js sürümünde dizgi değişince kırılır; fayda küçük | Elendi |

Dizinleme ve tarayıcılar:

| Seçenek | Artıları | Eksileri | Sonuç |
|---|---|---|---|
| Üretim dizinde; bütün tarayıcılara aynı kural, adsız | SEO ve GEO tam puanı üretimde de gösterilir; yasaklı terim kuralına dokunmaz; bakım yok | Kurgusal marka arama sonuçlarında görünür; botlar Hobby kotasını tüketebilir | Seçildi |
| Arama ve kullanıcı istekli ajanlara izin, eğitim tarayıcılarına ret | Kullanım tercihi belirtilir | Tarayıcı adları robots'a girer, bazıları repoda yasaklı terim; uyum gönüllü; adsız yöntemler (`Content-Signal`, IETF aipref) taslak | Elendi |
| Üretim `noindex` ya da bütün tarayıcılara ret | Arama sonuçlarında kurgusal firma yok; bot yükü düşük | Üretimde SEO 100 olamaz; GEO gösterilemez | Elendi |

## Karar

**Kalite hedeflerini ölçülebilir kapılara bağladım.** Ölçüm CI'da, yerel üretim derlemesine karşı yapılır: Lighthouse 13.6, axe-core 4.14 ve puppeteer-core 25, GitHub'ın Ubuntu çalıştırıcısındaki Chrome'da. Yeni iş `site-audit` üç kolla zorunlu kontrol olur. Lighthouse'un dört kategorisi mobilde ve masaüstünde 100; mobilde ilk ekran metinle açılır. `style-src 'self' 'unsafe-inline'`. Üretim dizine girer, önizlemeler girmez; robots bütün tarayıcılara aynı kuralı verir. Uçtan uca test çatısı eklemiyorum; sayfa denetimleri gerçek tarayıcıda.

Uyacağım kurallar:

1. **Tam puanın tanımı.** Lighthouse kapıları iki form faktöründe, şablon başına üç koşunun medyanıyla değerlendirilir.

   | Katman | Tam puan | Araç | İş |
   |---|---|---|---|
   | Performans | Mobil 100, masaüstü 100. Mobilde her şablonun LCP öğesi metin (kural 4). Bütçeler kural 6'da | Lighthouse 13.6.0, benzetimli kısıtlama | `site-audit (mobile)`, `site-audit (desktop)` |
   | Erişilebilirlik | Lighthouse 100. axe ihlali 0 (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice`); cihaz setinin her genişliğinde, iki dilde. Bileşen testlerinde axe ihlali 0 (`color-contrast` hariç: jsdom renk hesaplamıyor). Faz 8'de elle WCAG 2.2 AA incelemesi | Lighthouse; axe-core 4.14.0; Vitest | `site-audit`, `test` |
   | En iyi uygulamalar | Lighthouse 100. Hiçbir genişlikte konsol hatası ya da CSP ihlali yok | Lighthouse; puppeteer-core | `site-audit` |
   | SEO | Lighthouse 100. Herkese açık her URL 200 döner; kanonik mutlak ve sayfanın kendisi; `tr`, `en` ve `x-default` hreflang'ları karşılıklı; başlık ve açıklama iki dilde dolu; `robots.txt` ve `sitemap.xml` geçerli; JSON-LD ayrıştırılıyor, beklenen türde ve kanonikle aynı adreste | Lighthouse; kendi HTTP denetimim; `schema-dts` tipleri; birim testleri | `site-audit (pages)`, `test` |
   | GEO | SEO'nun hepsi, ayrıca: ana içerik, gezinme ve meta veri JavaScript olmadan ham HTML'de; `nosnippet` ve `max-snippet` yok; robots bütün tarayıcılara aynı kuralı verir; `lastmod` gerçek güncelleme zamanı. Yayında Search Console'un üretken yapay zekâ raporu | HTTP denetimi; testler; Search Console (elle) | `site-audit (pages)`, Faz 9 |
   | Ajan erişimi | Lighthouse "Agentic Browsing"de uygulanabilir bütün denetimler geçer. axe ihlali 0. Formlar etiketli, `autocomplete`'li, giriş türleri doğru, hata metni alana bağlı. İletişim formu JavaScript kapalıyken gönderilebilir. Sayfa açılışında açık modal, çerez duvarı ya da CAPTCHA yok | Lighthouse 13.6.0; axe; puppeteer-core | `site-audit` |
   | Duyarlı tasarım | 320–2560 px aralığında her 16 px'te ve cihaz setinde yatay taşma 0. `target-size` ihlali 0 (WCAG 2.2 AA, 24×24 CSS px). Her genişlikte görsel boyutu uygun (kural 5). `100vh` ve `h-screen` yok. `viewport-fit=cover` yok. Yalnız fareyle üzerine gelinerek erişilen içerik ya da eylem yok. Dört genişlikte elle görsel kontrol | puppeteer-core ve axe; Semgrep; elle | `site-audit (pages)`, `quality`, PR |

   Eşikler `tooling/site-audit/thresholds.json`'da. Kategoriler zaten 100 olduğu için hiçbir zaman 100'ün altına inmez; bütçeler yalnız küçülür. `policy`, kapsam eşiğindeki gibi gevşetmeyi reddeder; sıkılaştırma ayrı bir commit'tir.

2. **Ölçüm ortamı.** Her kol kendi çalıştırıcısında `pnpm build` ve `pnpm start` çalıştırır. Postgres servis konteynerine migration ve demo seed'i, var oldukları fazdan itibaren uygulanır. `SITE_URL=http://localhost:3000` olur; kanonik, hreflang ve sitemap kendi içinde tutarlı kalır. Chrome çalıştırıcıda kurulu olandır; sürümü rapora yazılır. Yerelde aynı denetimi aynı betikle çalıştırırım.

3. **Kararlılık.**
   - Lighthouse benzetimli kısıtlamayla çalışır (varsayılan).
   - Ölçümden önce her URL bir kez ısıtılır (ilk derleme ve görsel iyileştiricinin önbelleği).
   - Her URL için form faktörü başına üç koşu; kapı medyana bakar. Lighthouse dokümanı beş koşunun medyanını tek koşudan iki kat kararlı buluyor; Faz 3'teki ölçümde değişkenlik görürsem koşu sayısını beşe çıkarırım. Kararsızlıkta eşik düşmez; sayfanın payı (bütçe) küçülür.
   - Bir kolda Lighthouse koşuları sırayla çalışır; kollar ayrı makinelerde.
   - Gerçek eşik ihlali yeniden koşturulmaz. Altyapı kırmızısında mevcut kural geçerli: PR başına en fazla bir yeniden koşu.
   - Raporlar (Lighthouse JSON ve HTML, axe sonuçları, ekran görüntüleri) yedi gün saklanan artifact olur.

4. **Mobilde ilk ekran metinle açılır.**
   - Ana sayfada mobil LCP öğesi `h1`'dir: banner başlığı, yani değer önermesi. Banner görseli ikincildir: metnin altında durur ve ilk ekranda `h1`'den küçük alan kaplar ya da ilk ekranın altında başlar; mobilde LCP adayı olmaz.
   - Aynı ilke herkese açık bütün şablonlarda geçerli: mobilde ilk ekranın en büyük öğesi metindir. Ürün sayfasında ürün adı ve özeti önce, ürün görseli sonra; proje ve referans sayfalarında başlık ve açıklama önce.
   - `site-audit (mobile)` her şablonda Lighthouse'un LCP öğesinin metin olduğunu ayrıca denetler; kırmızının nedeni puan düşmeden görünür.
   - Masaüstünde görsel LCP serbest; denememde görsel LCP'li sayfa masaüstünde 100 aldı.
   - Bu kural tasarım incelemesindeki ilk ekran bulgusunu (T-01–T-03) da kapatıyor: ilk ekranda metin ve eylem var (DZ-01).

5. **Cihaz seti ve duyarlı tasarım ölçütleri.** Genişlikleri StatCounter'ın 2026-09 verisine ve WCAG 2.2'ye göre seçtim:

   | Sınıf | CSS px | Dokunma, DPR | Neden |
   |---|---|---|---|
   | Küçük telefon | 320×568 | evet, 2 | WCAG 1.4.10 yeniden akış: 1280 px'in %400 yakınlaştırması |
   | Android telefon | 360×800 | evet, 3 | Dünyada en yaygın ikinci |
   | iPhone | 390×844 | evet, 3 | Tasarım tabanı ve elle görsel kontroldeki telefon genişliği |
   | Büyük telefon | 414×896 | evet, 3 | Dünyada ve Türkiye'de en yaygın |
   | Yatay telefon | 844×390 | evet, 3 | Yönelim (WCAG 1.3.4); sabit header ve menünün kısa ekranda davranışı |
   | Dikey tablet | 768×1024 | evet, 2 | En yaygın tablet; `md` kesme noktası |
   | Yatay tablet, küçük dizüstü | 1024×768 | evet, 2 | `lg` kesme noktası; masaüstü menünün başladığı genişlik |
   | Masaüstü | 1440×900 | hayır, 1 | `xl` kesme noktası; elle görsel kontroldeki masaüstü genişliği |
   | Geniş masaüstü | 1920×1080 | hayır, 1 | Masaüstünde en yaygın (%28) |
   | Çok geniş masaüstü | 2560×1440 | hayır, 1 | İçerik genişliği sınırının denetimi |

   - **Taşma:** cihaz setinde ve 320–2560 px taramasında `document.documentElement.scrollWidth` görünüm genişliğini aşmaz. %200 yakınlaştırma 640 px'e, %400 yakınlaştırma 320 px'e denk düşer; ikisi de taramada. Yatay kaydırılan bir bileşen (ör. kategori çubuğu) kendi kaydırma kabında durur; sayfa taşmaz.
   - **Dokunma hedefi:** axe `target-size` (WCAG 2.5.8, 24×24 CSS px) dokunmalı genişliklerde ihlal vermez. Birincil denetimler (düğmeler, menü ve dil seçici) tasarım token'ıyla en az 44 px olur; bu bir tasarım kuralı, kapı değil.
   - **Yeniden akış ve metin:** `meta viewport` yakınlaştırmayı kapatmaz (axe `meta-viewport`); metin aralığı ve yönelim kilidi axe'in `avoid-inline-spacing` ve `css-orientation-lock` kurallarıyla.
   - **Güvenli alanlar:** `viewport-fit=cover` kullanılmaz; böylece tarayıcı içeriği çentik ve köşe alanlarının içinde tutar. Bir gün gerekirse sabit öğeler `env(safe-area-inset-*)` kullanır.
   - **Dinamik görünüm birimleri:** tam yükseklik `dvh` ya da `svh` ile verilir (`h-dvh`, `min-h-svh`). `100vh`, `h-screen` ve `min-h-screen` Semgrep kuralıyla yasak.
   - **Hover:** Tailwind 4'te `hover:` yalnız `(hover: hover)` destekleyen aygıtlarda uygulanıyor. Bilgi ya da eylem yalnız hover'la açılmaz; açılır içerik `aria-expanded`'lı bir düğmeyle açılır; ipuçları WCAG 1.4.13'e uyar. Bileşen testleri tıklama ve klavyeyle yazılır.
   - **Görsel boyutu:** cihaz setinin her genişliğinde her görselin seçilen kaynağının doğal genişliği, görünen genişlik çarpı DPR'den (en fazla 2) küçük değildir ve bunun iki katını aşmaz. `srcset`'li her görselin `sizes` niteliği vardır.
   - **Konsol:** hiçbir genişlikte konsol hatası ya da CSP ihlali yok.
   - **Elle görsel kontrol:** 390, 768, 1024 ve 1440 genişlikte; sabit header, menü ya da iletişim kutusuna dokunan değişikliklerde ayrıca 844×390. `site-audit (pages)` bu beş görünümün ekran görüntülerini artifact olarak yükler. Görsel fark (piksel karşılaştırma) testi yok.

6. **Performans bütçesi.** İlk değerler aşağıda; Faz 3'te çalıştırıcıda ölçüp kesinleştiririm, sonra yalnız küçülür.

   | Ölçü | Mobil (medyan) | Masaüstü (medyan) |
   |---|---|---|
   | Lighthouse performans | 100 | 100 |
   | LCP öğesi | metin | serbest |
   | CLS | en fazla 0,02 | en fazla 0,02 |
   | TBT | en fazla 90 ms | en fazla 60 ms |
   | JavaScript aktarımı | en fazla 180 KB | aynı |
   | CSS aktarımı | en fazla 30 KB | aynı |
   | Font | en fazla 2 dosya, 100 KB | aynı |
   | Toplam aktarım | en fazla 500 KB | aynı |

   TBT sınırları, diğer ölçüler tam iken kategori puanını 100'de tutan üst değerlerden geliyor (araştırma kaydı, bölüm 1).

   Tasarım kuralları:
   - Bileşenler varsayılan olarak sunucu bileşenidir; istemci bileşeni yalnız etkileşim için yazılır.
   - next-intl'in istemci sağlayıcısına yalnız gereken mesaj ad alanları verilir.
   - İlk ekrandaki görsel `next/image` ile `preload`, `fetchPriority="high"` ve doğru `sizes`'la yüklenir; ilk ekran dışındaki görseller tembel yüklenir.
   - Fontlar `next/font` ile, en fazla iki dosya.
   - Katalog görüntüleyicisi (S-08) yalnız kullanıcı açınca yüklenir.
   - Üçüncü taraf script yok.

   INP laboratuvarda ölçülmüyor; Lighthouse navigasyon kipinde ağırlığı 0, vekili TBT. Demo trafiği alan verisi (CrUX) oluşturmaya yetmez; gerçek kullanıcı ölçümü eklemiyorum.

7. **Yapılandırılmış veri ve JSON-LD (S-09'u kapatır).**
   - Tek bileşen: `src/components/json-ld.tsx`. Veriyi `<script type="application/ld+json">{serializeJsonLd(data)}</script>` olarak yazar. `serializeJsonLd`, `JSON.stringify` çıktısındaki her `<` karakterini `\u003c`'ye çevirir; React'in kendi kaçışına ek bir katmandır, ona güvenmez.
   - `dangerouslySetInnerHTML` kullanılmaz; Semgrep kuralım değişmez, istisna yok.
   - Yeni Semgrep kuralı: JSX `<script>` öğesi yalnız bu dosyada bulunabilir.
   - Veri bloğuna nonce verilmez; HTML standardına göre CSP denetimine girmiyor.
   - Tipler `schema-dts`'ten, yalnız `import type` ile.
   - Türler:
     - Ana sayfa: `WebSite` ve `Organization`. `Organization`'da ad, adres (URL), logo, `sameAs` (repo) ve `contactPoint` (e-posta, telefon, `hoursAvailable`, `areaServed`, `availableLanguage`) bulunur.
     - İletişim sayfası: `ContactPage`; aynı `Organization`'a `@id` ile başvurur.
     - İç sayfalar: `BreadcrumbList`.
     - `LocalBusiness` yok: marka kurgusal, fiziksel bir konumu yok; kurgusal posta adresi yapılandırılmış veriye girmez.
     - `Product` ve `Offer` yok: hiçbir şey satışta değil. Google'ın ürün parçacığı `offers`, `review` ya da `aggregateRating`'den birini istiyor; S-06'daki fiyat kararı bunu değiştirirse yeniden bakarım. Ürün bilgileri semantik HTML'de (`dl`) durur.
   - Yapılandırılmış veri yalnız sayfada görünen bilgiyi taşır.
   - Testler:
     - Bileşen `renderToString` ile sınanır: tek `</script>` kalır; `</script><script>` içeren bir dizgi ayrıştırıldığında aynen geri gelir.
     - Her veri yapıcısının zorunlu alanları birim testinde.
     - `site-audit (pages)` her sayfadaki JSON-LD'yi ayrıştırır; türünü ve adresini denetler.
     - Faz 9'da Zengin Sonuçlar Testi'ni ve Schema Markup Validator'ı üretimde elle çalıştırırım.

8. **Dizinleme, kanonik, hreflang ve sitemap.**
   - Üretim dizine girer. Önizleme dağıtımları Vercel'in `X-Robots-Tag: noindex` başlığıyla kalır.
   - Her sayfanın kanoniği kendi dilindeki mutlak adrestir; adresler her dilde kendi dilinde ([ADR 0006](0006-cok-dillilik-next-intl.md), kural 9). `metadataBase` doğrulanmış `SITE_URL`'den gelir.
   - hreflang tek bir yardımcı fonksiyondan üretilir ve yalnız HTML'de (`alternates.languages`) verilir: `tr`, `en` ve `x-default`. Ana sayfanın `x-default`'u dil yönlendirmesi yapan kök `/`; diğer sayfaların `x-default`'u Türkçe (varsayılan dildeki) adres. Google `x-default`'u eşleşmeyen diller ve dil seçici ya da yönlendirme sayfaları için tanımlıyor.
   - next-intl'in `Link` başlığı kapatılır (`alternateLinks: false`), tek kaynak kalır. Google üç yöntemi eşdeğer sayıyor; birden fazlasının arama için faydası yok.
   - Kök yönlendirmesi kalır. Önekli adresler hiç yönlendirilmez; Googlebot `Accept-Language` göndermediği için `/tr`'ye düşer; her sayfada diğer dile bağlantı vardır.
   - Metadata veritabanından iki dilde gelir ve iki dil de zorunludur; ADR 0006'nın eksik çeviri açık kalanı Faz 4'te bu yönde kapanır. Böylece hreflang çiftleri hep tamdır.
   - `sitemap.ts` dinamiktir (derleme anında veritabanı yok). Her dilin her adresi listelenir; `lastModified` kaydın `updatedAt`'idir.

9. **Tarayıcılar ve ajanlar.**
   - `robots.ts` bütün tarayıcılara aynı kuralı verir (`User-agent: *`): herkese açık sayfalar açık; `/api/` ve yönetim yolları kapalı; sitemap adresi yazılı. Hiçbir tarayıcı adıyla anılmaz.
   - `llms.txt`, ARD (`/.well-known/ard.json`) ve `Content-Signal` ya da `Content-Usage` satırı eklemiyorum. Google Arama `llms.txt` kullanmıyor; Lighthouse yokluğunu "uygulanamaz" sayıyor; ARD 0.91 ve IETF'in aipref çalışması henüz taslak. Bir yapay zekâ arama motoru `llms.txt`'i okuduğunu belgelerse yeniden değerlendiririm.
   - Ajan erişimi için:
     - Etkileşimli öğeler yerel `button` ve `a`.
     - Etiketler `for` ile alana bağlı.
     - Etkileşimli öğelerin üstünde saydam örtü yok.
     - Düzen kararlı (CLS bütçesi).
     - Demo bandı modal değil, sayfanın parçası.
     - CAPTCHA yok; iletişim formunu rate limit koruyor ([ADR 0004](0004-rate-limit.md)).
     - Çerez duvarı yok: next-intl'in dil çerezi oturum çerezi ve yalnız dil değişince yazılıyor.
   - İletişim formu Server Action'la yerel bir `form` olarak çalışır; JavaScript yüklenmeden de gönderilir. `site-audit (pages)` bunu JavaScript kapalı tek bir senaryoyla sınar. Kurallarımdaki tek işlevsel tarayıcı senaryosu bu.
   - `Permissions-Policy` başlığım WebMCP'nin `tools` özelliğini kapatmaz.

10. **CSP'de `style-src`.** `style-src 'self' 'unsafe-inline'`; script kuralı ADR 0001'deki gibi kalır (nonce, `'strict-dynamic'`, script için `'unsafe-inline'` yok). `next/image` ve React'in `style` özelliği satır içi `style` niteliği üretiyor; niteliğe nonce verilemiyor. Nonce'lu `style-src` bu nitelikleri engelliyor; denememde düzeni bozdu ve en iyi uygulamalar puanını düşürdü. Kalan risk CSS enjeksiyonu; onun için önce HTML enjeksiyonu gerekir, React metni kaçırıyor ve `dangerouslySetInnerHTML` yasak. Kodda yine `style` özelliği yazılmaz; stil Tailwind'de ([ADR 0005](0005-stil-tailwind-css-4.md)).

11. **Üretim performansı.** Kapı CI'daki laboratuvar ölçümü; üretim puanı kapı değil. Üretimde:
    - Vercel fonksiyon bölgesi ile Neon bölgesi aynı (Frankfurt: `fra1` ve `aws-eu-central-1`). Neon'un bölgesi proje oluşturulurken seçiliyor; bunu Faz 3'teki elle adımda yaparım; `vercel.json`'da `regions`.
    - Veritabanına havuzlu bağlantı adresiyle bağlanılır.
    - Ziyaret kaydı `after()` ile yanıttan sonra yazılır.
    - Herkese açık sayfalar oturum sorgusu yapmaz.
    - `unstable_cache` kullanmıyorum: Next.js 16'da yerini `use cache` aldı, o da Cache Components istiyor ve ADR 0001 onu kapalı tutuyor. Next.js 17'de bu konuya ADR 0001'le birlikte dönerim.
    - Faz 9'da üretimi PageSpeed Insights'la ölçer, sonucu araştırma kaydına yazarım.

12. **Kapsam.**
    - Herkese açık her sayfa şablonu iki dilde HTTP, axe, taşma ve konsol denetiminden geçer. Lighthouse kolları her şablonu Türkçe adresinde, ana sayfayı iki dilde ölçer; dile bağlı farklar (başlık, açıklama, `lang`, alternatif metin) zaten iki dilde denetleniyor.
    - 404 şablonu Lighthouse SEO'dan muaf (beklenen durum 404) ama axe, taşma ve konsol denetimine girer.
    - Yönetim paneli Faz 7'den itibaren demo admin oturumuyla `site-audit (pages)` denetimlerine girer (axe, taşma, konsol). Panel `noindex` olduğu için Lighthouse'suz.
    - Her sayfa şablonunun denetim listesinde bir adresi olur. `src/app/[locale]/(site)` altında listede adresi olmayan bir `page.tsx` varsa bir tooling testi kırar.

13. **`site-audit` işi.** `ci.yml`'de üç kol; her biri zorunlu kontrol:
    - `site-audit (pages)`: tarayıcısız HTTP denetimi (sitemap'teki her adres, robots, kök yönlendirmesi); tarayıcı denetimleri (genişlik taraması, cihaz seti, axe, konsol, görsel boyutu, açılışta açık modal); JavaScript'siz form gönderimi; ekran görüntüleri.
    - `site-audit (mobile)`: Lighthouse mobil, şablon başına üç koşu; LCP öğesinin metin olduğu.
    - `site-audit (desktop)`: Lighthouse masaüstü, şablon başına üç koşu.

    Betikler `tooling/site-audit/` altında, TypeScript (D5); medyan ve eşik mantığı `node --test` ile testli. Bağımlılıklar `devDependencies`'te tam sürümde: `lighthouse` 13.6.0, `puppeteer-core` 25.16.0, `axe-core` 4.14.0, `schema-dts` 2.1.0. Artifact `actions/upload-artifact` ile, SHA'yla sabit.

14. **Fazlar.**
    - Faz 3: `site-audit` iskelet sayfayla kurulur ve zorunlu kontrol olur; eşik dosyası ve `policy` denetimi; iki Semgrep kuralı (`<script>` öğesi, `100vh`); Neon ve Vercel aynı bölgede.
    - Faz 4: CSP PR'ı `style-src`'yi kural 10'a göre yazar; konsol denetimi CSP'yi gerçek tarayıcıda sınar.
    - Faz 5: dokunma hedefi ve görünüm yüksekliği token'ları; mobil ilk ekran tipografisi; bileşen testlerinde axe yardımcısı.
    - Faz 6: her sayfa PR'ı şablonunu denetim listesine ekler; ana sayfa ve diğer şablonlar mobilde metinle açılır; SEO, JSON-LD, robots ve sitemap; JavaScript'siz iletişim formu.
    - Faz 7: panel sayfaları denetime girer.
    - Faz 8: elle WCAG 2.2 AA incelemesi; bütçeler küçülür.
    - Faz 9: üretimin dizine girmesi, üretim ölçümü, yapılandırılmış veri doğrulaması.

## Sonuçlar

- Olumlu: Her katmanın "tam puan"ı bir ölçüt, bir araç ve kırmızıya dönen bir kontrol. README'deki iddia CI raporuna bağlanır.
- Olumlu: CSP ihlali, kırık düzen ve taşma gibi birim testinin göremediği hatalar gerçek tarayıcıda yakalanır. Denememdeki `style-src` hatası Lighthouse'un dört puanının hiçbirinde görünmüyordu.
- Olumlu: Mobilde metinle açılan ilk ekran hem performans kapısını hem tasarım incelemesinin ilk ekran düzeltmesini aynı anda karşılıyor.
- Olumlu: Ölçüm Vercel'den bağımsız; aynı betik yerelde Windows'ta da çalışır.
- Olumlu: S-09 istisnasız kapanır; `dangerouslySetInnerHTML` yasağı mutlak kalır.
- Olumsuz: Mobilde hiçbir şablonda görsel ilk ekranın en büyük öğesi olamaz. Ana sayfa banner'ı, ürün, proje ve referans sayfalarının görselleri mobilde metnin altında ya da ondan küçük durur; bu Faz 5 ve 6'nın tasarımını bağlar.
- Olumsuz: Kesin 100 kapısı koşular arası oynamaya karşı dar bir pay bırakıyor. Değişkenlikte eşik düşmez; koşu sayısı artar ya da sayfanın bütçesi küçülür.
- Olumsuz: CI her PR'da üç iş daha koşar; süresini Faz 3'te ölçerim. Strict dal korumasında kuyruktaki PR'lar bunları da yeniden koşar.
- Olumsuz: Dört yeni geliştirme bağımlılığı. axe-core MPL-2.0; yalnız geliştirmede, üretim paketine girmiyor; lisans politikam üretim bağımlılıklarına bakıyor. Lighthouse'un hata raporlama alt bağımlılığı var; CLI'da varsayılan kapalı, Node API'de kullanılmıyor.
- Olumsuz: Çalıştırıcıdaki Chrome'un sürümü sabit değil, imajla birlikte değişiyor; sürüm rapora yazılır.
- Risk: Üretim dizinde olduğu için arama ve yapay zekâ tarayıcıları dinamik sayfaları çağırıp Hobby'nin CPU ve çağrı kotasını tüketebilir; Hobby'de aşım 30 gün bekleme demek. Vercel'in AI Bots ve Bot Protection kural setleri Hobby'de de var; Faz 9'da önce "Log" kipinde izlerim (plan §9, E-09).
- Risk: Kurgusal marka arama sonuçlarında görünür. Demo bandı ve içerik markanın kurgusal olduğunu söyler; yapılandırılmış veride posta adresi ve `LocalBusiness` yok.
- Risk: Lighthouse'un ajan kategorisi deneysel. Bir Lighthouse güncellemesi yeni denetim getirip kapıyı kırabilir; bunu istediğim bir sinyal sayıyorum ve Dependabot PR'ında karşılarım.
- Kabul ettiğim boşluk: Otomatik denetim erişilebilirlik sorunlarının bir kısmını buluyor. Kalanını Faz 8'deki elle inceleme karşılar: klavye, ekran okuyucu, odak görünürlüğü ve gizlenmemesi (WCAG 2.4.11), sürükleme alternatifi (2.5.7, önce/sonra kaydırıcısı), erişilebilir kimlik doğrulama (3.3.8).
- Kabul ettiğim boşluk: Üretimin performansı ve INP alan verisi kapı değil.
- [ADR 0007](0007-test-stratejisi.md)'deki "tarayıcı test aracı yok" kararının bir kısmı değişti: işlevsel test ve uçtan uca test çatısı yine yok; sayfa denetimleri gerçek Chrome'da puppeteer-core ile koşuyor ve tek bir işlevsel senaryo (JavaScript'siz iletişim formu gönderimi) var. ADR 0007'nin durum satırı bunu gösterir.
- [ADR 0008](0008-ci-ve-koruma-katmanlari.md)'in bağlamındaki "Lighthouse kapıları yok" ifadesinin yerini bu karar alıyor; zorunlu kontrollere üç kol ekleniyor. ADR 0008'in durum satırı bunu gösterir.
- Açık kalanlar:
  - WebMCP: kaynak denemesi bitip kararlı Chrome'a girince iletişim formuna bildirimsel açıklama eklerim (Faz 9 ya da sonrası).
  - Çalıştırıcıdaki Chrome değişkenlik yaratırsa Chrome for Testing'in sabit bir sürümüne geçerim.
  - Bir kol on dakikayı aşarsa şablon listesini kollara bölerim.
  - Ürünün dilden bağımsız adres anahtarı değişince eski adresin 308 ile yönlendirilmesi: Faz 4, içerik şeması 2.
  - Sabit header'ın odaklanan öğeyi örtmediğinin denetimi: Faz 6, site düzeni PR'ı.
  - `Product` işaretlemesi: S-06'nın sonucuna bağlı.

## Kaynaklar

- [Araştırma kaydı](../research/2026-10-28-kalite-hedefleri.md)
- [Tasarım incelemesi](../research/2026-10-28-tasarim-incelemesi.md) (T-01–T-03, DZ-01)
- https://github.com/GoogleChrome/lighthouse/releases
- https://github.com/GoogleChrome/lighthouse/blob/v13.6.0/core/config/default-config.js
- https://github.com/GoogleChrome/lighthouse/blob/v13.6.0/core/gather/gatherers/accessibility.js
- https://developer.chrome.com/docs/lighthouse/agentic-browsing/scoring
- https://developer.chrome.com/docs/ai/webmcp
- https://web.dev/articles/ai-agent-site-ux
- https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- https://developers.google.com/search/docs/appearance/ai-features
- https://developers.google.com/search/docs/specialty/international/localized-versions
- https://developers.google.com/search/docs/appearance/structured-data/product-snippet
- https://nextjs.org/docs/app/guides/json-ld
- https://html.spec.whatwg.org/multipage/scripting.html#prepare-the-script-element
- https://www.w3.org/TR/WCAG22/
- https://gs.statcounter.com/screen-resolution-stats/mobile/worldwide
- https://vercel.com/kb/guide/are-vercel-preview-deployment-indexed-by-search-engines
- https://vercel.com/docs/vercel-firewall/vercel-waf/managed-rulesets
- https://registry.npmjs.org/lighthouse/13.6.0
- https://registry.npmjs.org/@lhci/cli/0.15.1
