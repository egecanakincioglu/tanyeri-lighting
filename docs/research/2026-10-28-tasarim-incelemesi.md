# Tasarım incelemesi: eski sitenin bilgi mimarisi, mesajı ve içerik hiyerarşisi

Tarih: 2026-10-28 · Kapsam: eski sitenin herkese açık sayfaları ve yönetim paneli · İlgili kararlar: [revizyon planı](../plans/2026-10-27-revizyon.md) (D6, Faz 4–7), [ADR 0005](../adr/0005-stil-tailwind-css-4.md), [ADR 0006](../adr/0006-cok-dillilik-next-intl.md)

Tasarımı sıfırdan yapmıyorum (D6). Eski sitenin sayfa seti, sayfa içi bölüm sırası ve ana sayfa blokları üzerinde düşünülmüş bir yapıydı; yeni sitenin temeli o olacak. Ama o yapıyı deneyimsizken kurmuştum. Üzerine bir şey kurmadan önce açık kurallara ve aynı sektördeki sitelere karşı denetledim: site bu tür bir şirketin vermesi gereken mesajı veriyor mu, içerik hiyerarşisi doğru mu, yapı sektördeki sitelerin hiyerarşisine uyuyor mu. Yeni kimlik (logo, renk, tipografi) eskisinin yerini alıyor ve stiller Tailwind CSS 4'te baştan yazılıyor; bu yüzden burada görsel kimliği değil yapıyı, mesajı ve hiyerarşiyi değerlendirdim. Eski stillerden ölçtüğüm değerler yalnız token'ların başlangıç noktası.

## Yöntem

- Eski kodu yalnız yerelde duran salt okunur rehberden okudum; eski siteyi çalıştırmadım. "Render edilen başlık" derken bileşenlerin ürettiği işaretlemeyi kastediyorum. Yalnız tarayıcıda görülebilecek iddiaları "doğrulanacak" diye işaretledim.
- Eski kod yollarını bağlantısız yazıyorum (`eski: src/...`), çünkü o klasör repoda yok.
- SCSS ölçümlerini küçük bir betikle yaptım: 59 SCSS dosyasındaki bildirimleri taradım, `variables.scss`'teki değişkenleri çözdüm, `rem`'i 16 px'e ve renkleri altı haneli hex'e çevirerek normalleştirdim. Herkese açık siteyi (23 dosya, 2.750 satır) ve paneli (28 dosya, 5.310 satır) ayrı saydım; kurulum sihirbazının 5 dosyası sayılara girmedi. `darken()`/`lighten()` sonuçları ve TSX'teki satır içi stiller sayıların dışında; adlı renkleri (`orange`, `darkorange`) elle ekledim. Kontrast oranlarını WCAG 2 bağıl parlaklık formülüyle hesapladım.
- Sektör karşılaştırması için 7 sitenin ana sayfasını 2026-10-28'de metin olarak okudum; görsel inceleme yapmadım. ERCO (429), XAL ve Zumtobel (403) isteği reddetti, LAMP 83'ün sitesi sertifika hatası verdi; bu dördünü sayamadım. Siteler değişir; sayılar o günkü durum.

## Özet

Kararım: eski sitenin iskeletini koruyorum, mesajını ve hiyerarşisini düzeltiyorum, menüsünü sektördeki sıraya göre değiştiriyorum.

- **Doğru olanlar:** Sayfa seti incelediğim 7 sitenin ortak setiyle örtüşüyor. Ana sayfa blokları (banner, öne çıkanlar, tanıtım panoları, çalışma alanları) yerinde. Ürün ayrıntısından iletişim formuna ürün bilgisiyle geçiş güçlü bir akış. Önce/sonra karşılaştırmalı projeler ayırt edici.
- **En büyük eksik ilk ekran:** Banner yalnız bir görsel. Şirketin kim olduğunu, ne sunduğunu, kime sunduğunu ve ziyaretçinin ne yapacağını söyleyen tek bir görünür cümle yok; değer önermesi yalnız meta açıklamasında. İncelediğim 7 sitenin hepsinde ilk ekranda metin, 6'sında bir eylem düğmesi var.
- **Hiyerarşi:** Ana sayfada iki `h1` var, hizmetler ve ürünler sayfalarında hiç yok. Başlık bileşeni metni iki kez yazıyor ve on kopya.
- **Dönüşüm:** Öne çıkan ürünler ürüne değil, ürün bilgisi taşımadan iletişim sayfasına gidiyor. Kataloglar adsız ve indirilemiyor. Projeler, referanslar ve hizmetlerden iletişime yol yok.
- **Menü:** "Ürünler" beşinci sırada ve açılır menünün arkasında; 7 sitenin hepsinde ilk iki sırada. 1550 px'in altında masaüstü menü hiç görünmüyor, yani 1440'ta da hamburger var.
- **Tutarlılık ve erişilebilirlik:** Sitede 24 yazı boyutu, 40 renk, 25 boşluk değeri ve 14 kesme noktası var. Hiç ARIA yok; düğme ya da bağlantı olmayan 6 tıklanabilir öğe, etiketsiz formlar, kapalı yakınlaştırma; birincil düğmelerde kontrast 2,5:1.
- **Panel:** Ekranlar yeterli ama gruplar sitenin yapısını izlemiyor; mesajlar menüde yok.

| Kural | Karar | Bulgular |
|---|---|---|
| Mesaj | değiştirilmeli | T-01–T-05 |
| Bilgi mimarisi | düzeltilmeli | T-06–T-12 |
| Sayfa içi hiyerarşi | düzeltilmeli | T-13–T-18 |
| Dönüşüm yolları | düzeltilmeli | T-19–T-24 |
| Tutarlılık | değiştirilmeli | T-25–T-32 |
| Erişilebilirlik temelleri | değiştirilmeli | T-33–T-41 |
| Mobil | düzeltilmeli | T-42–T-46 |
| Panelin bilgi mimarisi | düzeltilmeli | T-47–T-52 |

Plana etkisi: yedi yapı kararı (§7, S-11–S-17); Faz 4'ün iki içerik şeması maddesine birkaç alan; Faz 5'e ölçülen başlangıç token'ları ve üç ortak bileşen; Faz 6 ve 7'nin sayfa ve ekran maddelerine bu incelemenin düzeltmeleri. Yeni özellik eklemiyorum. Sektör normu olduğu için önerdiğim iki ana sayfa bölümü mevcut veriden besleniyor ve panelde yeni ekran istemiyor (DG-07).

## 1. Envanter

### 1.1 Ortak düzen

**Header** (eski: `src/components/Header.tsx`)

- Sırasıyla: logo (ana sayfaya bağlantı), menü, mobil menü düğmesi.
- Menü: Anasayfa · Kurumsal ▾ (Hakkımızda, Vizyonumuz, Referanslarımız) · Hizmetler · Projeler · Ürünler ▾ (Kataloglar, Kategoriler) · İletişim.
- Açılır menüler fareyle açılıyor; üst öğeleri bir sayfa değil (`href="#"`).
- 1550 px ve altında menü gizleniyor; yerine adsız bir hamburger düğmesi ve sağdan açılan yan menü (logo, aynı menü, kapatma düğmesi) geliyor.
- Eylem düğmesi, dil seçici ve arama yok. Header sayfayla birlikte kayıyor.

**Footer** (eski: `src/components/Footer.tsx`)

- Logo; adres, telefon ve e-posta düz metin (`tel:`/`mailto:` yok); dört metinsiz sosyal ikon (WhatsApp, Instagram, X, Facebook); telif satırı; geliştirici imzası; "Gizlilik ve Çerezler" ve "Şartlar ve Koşullar" bağlantıları.
- Site bölümlerine bağlantı yok.

**Sayfa kabuğu**

- Ortak bir site düzeni yok; her sayfa header ve footer'ı kendisi çağırıyor. `GeneralLayout` adlı düzen aslında panel düzeninin bir kopyası.
- Bütün içerik istemcide çekiliyor; veri gelene kadar tam sayfa bir yükleme göstergesi görünüyor (eski: `src/components/utils/UploadData.tsx`). Ana sayfada iç içe iki veri sağlayıcısı olduğu için gösterge arka arkaya iki kez çıkıyor. Sunucudan gelen HTML'de içerik yok.
- `<html lang="tr">` sabit; yazı tipi Google Fonts'tan Nunito 400 ve 700; görüntü alanı etiketi `maximum-scale=1.0, user-scalable=no` (eski: `src/components/utils/Seo.tsx`).

### 1.2 Herkese açık sayfalar

| Sayfa (eski yol) | Bölüm sırası | Render edilen başlıklar | `h1` sayısı | Birincil eylem | Panelden düzenlenen |
|---|---|---|---|---|---|
| Ana sayfa (`/`) | banner görseli → "Favori Ürünlerimiz" → 3 tanıtım panosu ve 6 öne çıkan ürün aynı ızgarada → "Çalışma Alanlarımız" → 6 kart | h1 "Favori Ürünlerimiz", h1 "Çalışma Alanlarımız", h3 ×6 | 2 | yok; pano `/catalogs?catalogIndex=i`'ye, öne çıkan ürün `/contact`'a gidiyor | banner; panolar (görsel); öne çıkanlar (görsel, başlık); çalışma alanları (görsel, başlık, açıklama) |
| Hakkımızda (`/about`) | başlık → ortalanmış tek paragraf | h1 "Hakkımızda" | 1 | yok | metin |
| Vizyon (`/vision`) | başlık → tek paragraf (satır sonları kayboluyor) | h1 "Vizyonumuz" | 1 | yok | metin |
| Hizmetler (`/services`) | 4 kart (görsel, başlık, kısa açıklama, "Devamını Oku") → pencerede ek açıklama | h3 ×4, pencerede h3 | 0 | "Devamını Oku" (pencere) | 4 hizmet: görsel, başlık, açıklama, ek açıklama |
| Projeler (`/projects`) | başlık → yönerge cümlesi → sayfa başına 4 proje (başlık, önce/sonra kaydırıcı, "Proje Detayları") → sayfalama | h1 "Projelerimiz" (koda gömülü); her projede h3 başlık ve altında h2 "Proje Detayları" | 1 | yok | önce ve sonra görseli, başlık, ayrıntı |
| Referanslar (`/references`) | başlık → 16'lık logo ızgarası → sayfalama; tıklanınca pencere (logo, ad, açıklama, "Ziyaret Et") | h1 "Referanslarımız" (koda gömülü), h3 ×16'ya kadar, pencerede h2 | 1 | "Ziyaret Et" (referansın sitesi) | logo, ad, açıklama, web adresi |
| Kataloglar (`/catalogs`) | başlık → sayfa çevirmeli PDF görüntüleyici → "Önceki Katalog" / "Sonraki Katalog" | h1 "Ürün Kataloglarımız" | 1 | yok; indirme yok | PDF dosyası (ad alanı yok) |
| Kategoriler (`/categories`) | kaydırma ipucu → kategori sekmeleri → 24'lük ürün ızgarası → sayfalama; ürün tıklanınca pencere (özellikler, "Teklif Al") | yok; ürün adları `<p>` | 0 | "Teklif Al" → `/contact?productId=…` | en çok 8 sıralı kategori; ürün: görsel, ad, kod, renk, malzeme, güç, boyutlar, fiyat |
| İletişim (`/contact`) | başlık → "Projenizi Tartışalım" (telefon, e-posta, WhatsApp) ve form (ad, e-posta, konu, mesaj) | h1 "Bize Ulaşın", h3 "Projenizi Tartışalım" | 1 | "Mesaj Gönder" | telefon, e-posta, WhatsApp; çalışma saatleri yalnız yapılandırılmış veride, sayfada görünmüyor |
| Gizlilik (`/privacy`) | başlık → aynı konuda ikinci başlık → giriş → 7 bölüm | h1 "Gizlilik Politikası", h2 "… Gizlilik ve Çerez Politikası", h3 ×7 | 1 | yok | yok (metin `seo.json`'da) |
| Şartlar (`/terms`) | başlık → ikinci başlık → giriş → 10 bölüm | h1 "Şartlar ve Koşullar", h2 tekrarı, h3 ×10 | 1 | yok | yok |
| 404 | "404", "Aradığınız sayfa bulunamadı", "Ana Sayfaya Dön" düğmesi; header ve footer yok | h1 "404" | 1 | ana sayfaya dön | yok |

Başlık bileşeni 9 sayfada başlık metnini önce arka plan süsü olarak bir `<span>`'de, sonra `<h1>`'de yazıyor (eski: `src/components/*Title.tsx`).

### 1.3 Varsayılan metinler ve dosyalar

- `seo.json`: bölüm başlıkları (arka plan ve ön metin aynı), sayfa başına başlık, açıklama ve anahtar kelime, gizlilik ve şartlar metinleri (HTML içeren dizgiler), çalışma günleri ve saatleri, hizmet bölgesi, diller. Varsayılan sayfa başlığı "{ad} - Aydınlatma Çözümleri"; açıklama "modern ve yenilikçi aydınlatma çözümleriyle ev ve iş yerlerine estetik, enerji tasarruflu ve uzun ömürlü ürünler sunar". Sitenin değer önermesi yalnız bu meta açıklamasında; sayfada hiçbir yerde görünmüyor. Kategoriler sayfasının açıklaması ana sayfanınkiyle aynı.
- Şartlar metninin 6. bölümü bir HTML dizgisinin içine React'in `<Link>` bileşenini yazıyor; tarayıcı bunu bağlantı olarak değil başka bir etiket olarak işler, "Çerez Politikası" bağlantısı çalışmaz.
- `src/lib/config/files.ts`: blok adetleri (banner 1, öne çıkanlar 6, panolar 3, çalışma alanları 6, hizmetler 4, en çok 8 kategori), metin alanları ve uzunlukları (ad 256, hakkımızda ve vizyon 4.096 karakter), ziyaret istatistiğindeki sayfa adları ("Gizlilik", "Koşullar", "Vizyon"…).
- `src/lib/config/strings.ts`: yalnız telefon ülke kodu; arayüz metinleri bileşenlere gömülü.
- `public/`: `sitemap.xml` 8 adres listeliyor; olmayan `/products` var, `/catalogs`, `/categories`, `/projects` ve `/references` yok. `robots.txt` paneli ve API'yi dışlıyor. `site.webmanifest`'in kategorilerinde "shopping" var; sitede satış yok.

### 1.4 Yönetim paneli

Menü (eski: `src/components/admin/AdminNavbar.tsx`), 9 üst öğe ve 19 ekran:

| Grup | Öğeler | Not |
|---|---|---|
| İstatistikler | (tek ekran) | Google Ads istatistikleri, ziyaretçi istatistikleri (ülke dağılımı, sayfa görüntüleme, günlük ziyaret) ve "Gelen Mesajlar" aynı ekranda (eski: `src/pages/dashboard/view.tsx`) |
| Kurumsal Ayarlar | Logo Güncelleme, İsim Güncelleme, İletişim Bilgileri, Sosyal Medya, Referans Yönetimi | |
| Site Ayarları | Banner Güncelleme, Reklam Panoları, Favori Ürünler, Çalışma Alanları, Hakkımızda, Vizyon | |
| Yönetici Ayarları | Email Güncelleme, Şifre Güncelleme | |
| Ürünler | Katalog Yükleme, Kategorileri Güncelle | kategoriye girilince ürün yönetimi |
| Hizmetler | Hizmetleri Yönet | tek öğe |
| Projeler | Projeleri Yönet | tek öğe |
| Entegrasyonlar | Google Ads | tek öğe |
| Destek | (tek ekran) | planda alınmıyor |

- Giriş `/dashboard`'ta ("Yönetim Paneline Güvenli Giriş", yer tutucular "Kullanıcı Adı" ve "Şifre", "Şifremi Unuttum"); şifre sıfırlama panelin dışında, `/forgot-password`'te.
- Akışlar: (1) sabit yuvalı görsel blokları: yuvaya görsel yükle, başlık ve açıklama yaz, "Temizle" ya da "Güncelle"; (2) liste ve pencere: referans, proje, kategori ve ürün ekle ya da düzenle, silmeden önce "UYARI!" penceresi; (3) metin alanı ve "Güncelle": hakkımızda, vizyon, şirket adı; (4) mesaj kartı: "Yanıtla" (`mailto:`), "Sil".
- Tanıtım panoları ekranı "3 reklam panosunun fotoğrafını seçin" diyor; panonun hangi kataloğa gittiğini söylemiyor.

## 2. Sektör karşılaştırması

### 2.1 İncelediğim siteler

Üç Türk, dört Avrupalı üretici. Hepsinin ana sayfasını 2026-10-28'de okudum.

| Site | Ana menü (sırasıyla) | İlk ekran | Ürün ve katalog | Proje ve referans | İletişim | Güven işaretleri |
|---|---|---|---|---|---|---|
| [Pelsan](https://www.pelsan.com.tr/) (TR) | AnaSayfa, Ürünler, Dökümanlar, Referanslar, İletişim; üst çubukta Hakkımızda, Laboratuvar, Teknik, Blog, Haberler | "9 KATEGORİDE 3500'Ü AŞKIN ÜRÜN ÇEŞİDİ" ve kategori kartları | 9 kategori kartı; "Dökümanlar" üst menüde | "Referanslar" üst menüde | "İletişim" menüde; sayfa sonunda "TÜM AYDINLATMA İHTİYAÇLARINIZ İÇİN TEK ADRES" bloğu | 42 yıl, üretim alanı, ihracat yapılan ülke sayısı |
| [EAE Aydınlatma](https://www.eaeaydinlatma.com/) (TR) | Kurumsal, Ürünler, Akademi, Kariyer, Referanslar, Katalog, Bize Ulaşın, Blog | kaydırıcı ve başlık "Endüstriyel, Mimari ve Ex-Proof Aydınlatma Çözümleri" | ürün aileleri menüde; "Öne çıkan Aydınlatma Ürünleri"; "Katalog" üst menüde | "Referanslarımızı Keşfedin" ana sayfada, sektöre göre (eğitim, hastane, ofis, perakende…) | "Bize Ulaşın" | 42 yıl, adıyla referanslar, sertifikalar sayfası |
| [Horoz Elektrik](https://www.horozelektrik.com/) (TR) | Ürünler, Kurumsal, Kariyer, Katalog, Haberler, İletişim, B2B | ürün bandı ve "Daha Fazla Bilgi" | "Yeni Ürünler", "En Çok Satanlar"; "Katalog" üst menüde ve ana sayfada | yok | "İletişim" | 30 yıl, rakamlar bölümü, grup şirketleri |
| [iGuzzini](https://www.iguzzini.com/) (İtalya) | PRODUCTS, Services, Inspiration, Configurators; ikincil: About us, Contacts | "LIGHT THAT MOVES" ve "Discover more" | iç mekân ve dış mekân kutuları; "Downloads" footer'da | "Every project counts" ana sayfada, uygulama alanına göre (perakende, kültür, konaklama, ofis, kent, altyapı) | "Contacts" ikincil menüde; "Technical Consulting" hizmeti | ödüller, EcoVadis, garanti, sertifikalar |
| [Delta Light](https://www.deltalight.com/en) (Belçika) | Inspiration, Products, Technical resources, About Deltalight | kaydırıcı, "Discover Lunelle" düğmesi | kategori grupları; "Download center"; "Request a catalogue" | Inspiration ▸ Projects, sektöre göre; ana sayfada proje vitrini | footer'da "Contact"; "Supporting your projects" | "Belgian and family run since 1989", EcoVadis, ISO sertifikaları |
| [Arkoslight](https://www.arkoslight.com/en) (İspanya) | Products, Projects, Journal, Light & Life 1984, Sustainability, Professionals, Contact | öne çıkan ürün, "View product" | kategoriler; Professionals ▸ Downloads (Catalogues); "Browse iCatalogue" | sektöre göre süzülen projeler; ana sayfada 4 proje kartı | "Contact" menüde; "Consulting service for professionals", "Projects service" | Red Dot 2026, "Since 1984", proje referansları |
| [Louis Poulsen, profesyonel](https://www.louispoulsen.com/en/professional) (Danimarka) | Products, Explore, Reflections, About | "Toolbox" kutuları (Projects, Downloads, Contact…) | "Explore our categories" (iç mekân, mimari, dış mekân); "Downloads" | "Projects" kutusu ilk ekranda | "Request a meeting" bölümü; "Contact" kutusu ve footer'da | deneyim vurgusu, garanti |

### 2.2 Ortak hiyerarşi

1. **Ürünler menünün başında:** 7/7 sitede ürünler üst menüde ve ilk iki sırada. "Ana sayfa" bağlantısı yalnız 1/7 sitede var; diğerlerinde bu işi logo yapıyor.
2. **İlk ekran metinle konuşuyor:** 7/7 sitede ilk ekranda bir başlık, 6/7'de bir eylem düğmesi var. Başlık ya ürün çeşitliliğini (Pelsan), ya hizmet verilen alanları (EAE), ya da öne çıkan ürünü söylüyor.
3. **Projeler ve referanslar kanıt olarak öne çıkıyor:** 5/7 sitede üst menüde (Inspiration, Projects, Referanslar), 4/7'de ana sayfada bir bölüm olarak; 4/7'de uygulama alanına ya da sektöre göre gruplanmış.
4. **Katalog ya da indirme her yerde var:** 7/7. Türk sitelerinde üst menüde (3/3: Dökümanlar, Katalog, Katalog); Avrupalı sitelerde teknik kaynaklar ya da profesyoneller başlığı altında veya footer'da.
5. **İletişim her yerden bir adımda:** 5/7 sitede üst ya da ikincil menüde; diğer ikisinde ilk ekranda ve footer'da. **"Teklif" etiketi hiçbirinde yok (0/7);** onun yerine "Contact", "Bize Ulaşın", danışmanlık ya da görüşme talebi (4/7) ve katalog talebi var.
6. **Kurumsal içerik bir grupta:** hakkımızda kurumsal bir başlık altında ya da menünün sonunda; vizyonu ayrı bir menü sayfası olarak sunan site yok (0/7).
7. **Güven işaretleri:** kuruluş yılı ya da faaliyet süresi 5/7, ödül ya da sertifika 4/7, adıyla proje ya da referans 4/7. Kurgusal bir markada ödül ve sertifika uyduramam; elimdeki kanıt projeler ve referanslar.
8. **Footer bir site haritası:** 7/7 sitede footer'da site bağlantıları var; 6'sında gruplar halinde (ürün kategorileri, kurumsal, indirmeler, iletişim, sosyal, yasal).
9. **Dil seçimi görünür:** Türk sitelerinin üçünde de Türkçe ve İngilizce seçeneği var (Horoz'da yalnız footer metninden çıkardım; tam doğrulayamadım).

## 3. Kurallara göre bulgular

Karar sözcükleri: **uygun** (koruyacağım), **düzeltilmeli** (yapı kalır, uygulaması düzelir), **değiştirilmeli** (yapı ya da yaklaşım değişir).

### 3.1 Mesaj

İlk ekranda kim olduğu, ne sunduğu, kimin için olduğu ve ziyaretçinin ne yapacağı açık mı; değer önermesi var mı; güven işaretleri ikna ettikleri yerde mi?

| No | Ölçüt | Karar | Kanıt |
|---|---|---|---|
| T-01 | Kim olduğu | değiştirilmeli | Banner yalnız bir `<img>`; metin yok (eski: `src/components/Banner.tsx`). Şirket adı yalnız logonun alternatif metninde. 1550 px'in altında menü de gizli olduğu için 1440'ta ilk ekranda logo, hamburger ve görselden başka bir şey yok. |
| T-02 | Ne sunduğu ve kimin için | değiştirilmeli | Değer önermesi yalnız meta açıklamasında (`seo.json`, `page.description`); sayfada render edilmiyor. "Kimin için"i söyleyen çalışma alanları ana sayfanın en sonunda. İlk görünen başlık "Favori Ürünlerimiz". |
| T-03 | Sonraki adım | değiştirilmeli | İlk ekranda eylem yok; header'da "İletişim" sıradan bir menü öğesi ve 1440'ta hamburgerin içinde. Sektörde 6/7 sitede ilk ekranda bir eylem düğmesi var. |
| T-04 | Güven işaretlerinin yeri | düzeltilmeli | Projeler ve referanslar ana sayfada yok; referanslar "Kurumsal" açılır menüsünün üçüncü öğesi. Sektörde 4/7 sitede ana sayfada proje ya da referans bölümü var. |
| T-05 | İlk görüntü | değiştirilmeli | İçerik istemcide çekiliyor; sunucu HTML'i yalnız bir yükleme göstergesi, ana sayfada gösterge iki kez (eski: `UploadData.tsx`, `src/pages/index.tsx`). Yeni mimaride sayfalar sunucuda render ediliyor (plan §5); ayrı bir madde gerekmiyor. |

### 3.2 Bilgi mimarisi

| No | Ölçüt | Karar | Kanıt |
|---|---|---|---|
| T-06 | Sayfa seti | uygun | 11 sayfa ve 404, 7 sitenin ortak setiyle örtüşüyor: ürünler, katalog, projeler ve referanslar, hakkımızda, hizmetler, iletişim, yasal sayfalar. |
| T-07 | Menü sırası | değiştirilmeli | "Ürünler" beşinci sırada ve tıklanınca bir sayfa açmıyor, yalnız açılır menüyü açıyor. Sektörde 7/7 sitede ürünler ilk iki sırada. |
| T-08 | Gruplama | düzeltilmeli | "Referanslarımız" "Kurumsal" altında, "Projeler" üst seviyede: aynı işi gören iki kanıt sayfası farklı yerlerde. İki açılır menü 3 ve 2 öğeli; ikisinin üst öğesi de bir sayfa değil. |
| T-09 | Örtüşen sayfalar | düzeltilmeli | Vizyon ve hakkımızda aynı düzende birer paragraf; vizyonun ayrı bir sayfayı taşıyacak içeriği yok (sektörde 0/7). Hizmetler (ne yapıyoruz) ile çalışma alanları (kimin için) farklı şeyler ama "Çalışma Alanlarımız" adı hizmet gibi okunuyor. "Kategoriler" sayfası aslında ürün listesi; adı içeriği değil gezinme biçimini söylüyor. |
| T-10 | Ad tutarlılığı | düzeltilmeli | Menüde "Anasayfa" (doğrusu "Ana sayfa"). Menü "Hizmetler", "Projeler" derken sayfa başlıkları "Hizmetlerimiz", "Projelerimiz"; menüde "Vizyonumuz", "Referanslarımız" iyelik ekli, diğerleri değil. Gizlilik sayfasının üç adı var: footer'da "Gizlilik ve Çerezler", `h1`'de "Gizlilik Politikası", `h2`'de "… Gizlilik ve Çerez Politikası". Şartlar sayfasının da üç: "Şartlar ve Koşullar", meta başlıkta "Kullanım Şartları", istatistikte "Koşullar". Panel aynı bölümlere başka adlar veriyor ("Favori Ürünler", "Reklam Panoları"; planda "öne çıkanlar", "tanıtım panoları"). |
| T-11 | Adres dili | düzeltilmeli | Yalnız Türkçe olan sitede adresler İngilizce (`/about`, `/catalogs`). Yeni sitede iki dil var; karar §7'de (S-16). |
| T-12 | Derinlik ve kopuk sayfalar | düzeltilmeli | Derinlik en çok 2, bu uygun. Ama `sitemap.xml` dört sayfayı dışarıda bırakıyor ve olmayan `/products`'ı listeliyor; 404 sayfasında menü yok, ziyaretçi çıkmaza giriyor; ürün ayrıntısının adresi yok (pencere), paylaşılamıyor ve arama motoru göremiyor. |

### 3.3 Sayfa içi içerik hiyerarşisi

| No | Ölçüt | Karar | Kanıt |
|---|---|---|---|
| T-13 | Tek `h1` | değiştirilmeli | Ana sayfada 2 `h1` ("Favori Ürünlerimiz", "Çalışma Alanlarımız"), hizmetler ve kategorilerde 0, diğerlerinde 1. Ana sayfanın `h1`'leri bölüm adı; sayfanın konusunu söylemiyor. |
| T-14 | Sıralı başlıklar | düzeltilmeli | Ana sayfada `h1`'den `h3`'e atlıyor; projelerde proje başlığı `h3` ve altında `h2` "Proje Detayları" (ters ve her projede tekrar); iletişimde `h1`'den `h3`'e; gizlilik ve şartlarda `h2` `h1`'i tekrar ediyor; referans ızgarasında `h3`, penceresinde `h2`. |
| T-15 | Yinelenen dekoratif başlık | düzeltilmeli | Başlık bileşeni metni arka plan süsü olarak bir `<span>`'de ve `h1`'de iki kez yazıyor; ekran okuyucu 9 sayfada başlığı iki kez okur. Aynı bileşenin 10 kopyası var (T-31). |
| T-16 | Önemli içerik önce | düzeltilmeli | Ana sayfada değer önermesi yok, "kimin için" en sonda; iletişimde adres ve çalışma saatleri görünmüyor; kataloglarda katalog adı yok; hizmetlerin asıl açıklaması pencerede saklı. |
| T-17 | Taranabilirlik | düzeltilmeli | Hakkımızda uzun metni ortalanmış tek paragraf (eski: `About.module.scss`, `text-align: center`, masaüstünde %50 genişlik); vizyonda satır sonları kayboluyor; ürün listesinde başlık yok, ürün adları `<p>`. |
| T-18 | Bölüm amaçlarının örtüşmesi | düzeltilmeli | Tanıtım panoları ve öne çıkan ürünler tek ızgarada ve tek başlık ("Favori Ürünlerimiz") altında; oysa panolar ürün değil katalog bağlantısı (eski: `src/components/Highlights.tsx`). |

### 3.4 Dönüşüm yolları

| No | Ölçüt | Karar | Kanıt |
|---|---|---|---|
| T-19 | Ürün → iletişim | uygun | Ürün penceresindeki "Teklif Al" iletişime ürün kimliğiyle gidiyor; form konu ve mesajı ürün adı ve koduyla dolduruyor (eski: `ProductModal.tsx`, `ContactForm.tsx`). Akışı koruyorum. Eski sitede gerçekten çalıştığını onu çalıştırmadan doğrulayamadım (doğrulanacak); yeni kodda testle sınayacağım. |
| T-20 | Öne çıkan ürün → ürün | değiştirilmeli | Öne çıkan ürün kartı `/contact`'a ürün bilgisi taşımadan gidiyor. Öne çıkanlar ürün kayıtlarına bağlı değil; ayrı yüklenmiş bir görsel ve bir başlık. Aynı ürünün görselini iki kez yüklemek gerekiyor. |
| T-21 | Tanıtım panosu → katalog | düzeltilmeli | Pano *i* katalog *i*'ye gidiyor (sıra eşleşmesi); panel bu bağı göstermiyor. Eşleşen katalog yoksa pano tıklanmıyor ama hover'da büyüyüp döndüğü için tıklanabilir görünüyor. |
| T-22 | Katalog → indirme | değiştirilmeli | Katalogların listesi ve adı yok; sırayla "Önceki/Sonraki Katalog" ile geziliyor; indirme bağlantısı yok; sayfalar resim olarak çiziliyor, metin seçilemiyor, alternatif metin İngilizce "Page N". Sektörde katalog ya da indirme 7/7 sitede var. |
| T-23 | Proje, referans, hizmet → iletişim | düzeltilmeli | Üç sayfada da iletişime bir eylem yok; çalışma alanı kartları hiçbir yere gitmiyor. |
| T-24 | Eylemin her yerden erişilebilirliği | düzeltilmeli | Header'da öne çıkan bir eylem yok; footer'daki telefon ve e-posta tıklanmıyor; 404'te menü yok. Sektörde iletişim 5/7 sitede üst menüde, diğer ikisinde ilk ekranda ve footer'da; ayrı bir "teklif" sayfası 0/7. |

### 3.5 Tutarlılık

Sayılar herkese açık sitenin SCSS'inden (23 dosya); panel ayrıca belirtildi.

| No | Ölçüt | Karar | Kanıt |
|---|---|---|---|
| T-25 | Yazı boyutları | değiştirilmeli | 24 farklı boyut (22 sabit, 2 `clamp()`); panelde 23. `px` ve `rem` karışık; aynı boyut iki birimle yazılmış (14 px ve 0,875 rem). |
| T-26 | Yazı ağırlıkları | düzeltilmeli | 500, 600, 700 ve 800 kullanılıyor ama yalnız 400 ve 700 yükleniyor; tarayıcı en yakın yüklü ağırlığı seçtiği için fiilen iki ağırlık var. Header'daki `Arial` bildirimi `* { font-family: Nunito }` kuralı yüzünden etkisiz. |
| T-27 | Renkler | değiştirilmeli | 40 farklı değer (30 opak, 9 yarı saydam, `transparent`); panel ve kurulum dahil 70'in üstünde. Aynı turuncu vurgunun 7 tonu var (`#f9a22e`, `#ff7f00`, `#ff7f0e`, `#e66b00`, `#e96e0a`, `orange`, `darkorange`) ve 20 nötr. `variables.scss`'te 399 değişken var ama yalnız 77 farklı değer; üç değişken iki kez tanımlı ve ikincisi sessizce kazanıyor (footer yasal bağlantılarının rengi `#666` yerine `#999` oluyor; T-40). Panelde ikinci bir vurgu (mavi `#4a90e2`) ve lacivert menü var. |
| T-28 | Boşluklar | değiştirilmeli | 25 farklı değer; 14'ü 4'ün katı değil (5, 10, 15, 25, 30, 35, 50 px…). Boşlukta `vh` de kullanılmış (7vh, 5vh, satır içi 1vh). |
| T-29 | Köşe, gölge, geçiş, katman | değiştirilmeli | 9 köşe yarıçapı, 14 gölge, 24 farklı geçiş bildirimi (0,2, 0,3 ve 0,4 s), 7 farklı `z-index` (0'dan 9999'a; katalog düğmelerinde satır içi 9999). |
| T-30 | Kesme noktaları | değiştirilmeli | 20 farklı medya sorgusunda 14 farklı genişlik: 360, 480, 481, 767, 768, 769, 1024, 1025, 1200, 1240, 1279, 1280, 1440, 1550. Ayrıca 3 bileşende Tailwind'in varsayılan kesme noktaları (640, 768, 1024, 1280) ve iki bileşende JavaScript'te 768: üç ayrı sistem. |
| T-31 | Tekrarlanan kalıplar | değiştirilmeli | Bölüm başlığı 10 kopya (9 dosya, bir de projeler bileşeninin içinde); sayfalama 3 ayrı uygulama (projeler, ürünler, referanslar); pencere 3 (hizmet, ürün, referans); kart 2 (çalışma alanı, hizmet; aynı yaylı hover); %70 genişlikli kapsayıcı 15 dosyada ayrı ayrı. |
| T-32 | İki stil sistemi | düzeltilmeli | Tailwind 3'ün temel stilleri etkin (eski: `src/styles/globals.scss`) ve 9 bileşende (5 site, 4 panel) SCSS modülüyle aynı bileşende Tailwind sınıfları var (`flex`, `grid`, `text-red-600`…). [ADR 0005](../adr/0005-stil-tailwind-css-4.md)'in bağlamındaki "Tailwind kuruluydu ama hiç kullanılmıyordu" cümlesi bu yüzden eksik. Yeni kodda "bir bileşende tek sistem" kuralı bunu zaten önlüyor. |

### 3.6 Erişilebilirlik temelleri

| No | Ölçüt | Karar | Kanıt |
|---|---|---|---|
| T-33 | Landmark'lar | düzeltilmeli | `header`, `nav` ve `footer` var; `main` 11 sayfanın yalnız 2'sinde (ana sayfa, iletişim); içeriğe atlama bağlantısı yok. |
| T-34 | Düğme yerine tıklanabilir öğe | değiştirilmeli | 6 yerde düğme ya da bağlantı yerine tıklanabilir öğe var: tanıtım panosu (`div`), kategori sekmesi (`li`), ürün kartı (`div`), referans kartı (`div`), yan menüdeki açılır başlık (`href`'siz `a`), önce/sonra tutamacı (yalnız fare ve dokunma). Kategori listesinde `ul`'un doğrudan çocuğu bir `div`; işaretleme geçersiz. |
| T-35 | Erişilebilir ad ve rol | değiştirilmeli | Site bileşenlerinde hiç `aria-*` ya da `role` yok. Adı olmayan 9 denetim var: hamburger, yan menüyü kapatma, 4 sosyal bağlantı, 3 pencere kapatma ("✖" ya da "×"). Pencerelerde iletişim kutusu rolü, odak yönetimi ve Esc yok. |
| T-36 | Alternatif metinler | değiştirilmeli | 9 görselin alternatif metni harfi harfine "Öne çıkan ürün {url}" ya da "Reklam panosu {url}": yer tutucu hiç doldurulmuyor, çünkü metin değiştiricide `url` anahtarı yok (eski: `src/lib/helpers/seo.ts`). 6 öne çıkan ürün aynı metni taşıyor. Katalog sayfaları İngilizce "Page N"; proje görselleri sayfadaki sıraya göre "Proje 1 Öncesi". |
| T-37 | Form etiketleri | değiştirilmeli | İletişim formunun 4 alanı ve giriş formunun 2 alanı yalnız yer tutucu metinle; görünür ya da bağlı etiket yok. Gönderim sonucu ekran okuyucuya duyurulmuyor. |
| T-38 | Odak | değiştirilmeli | Site SCSS'indeki tek `:focus` kuralı (iletişim formu alanları) odak halkasını `outline: none` ile kaldırıp yerine 1 px turuncu kenarlık koyuyor; bu kenarlığın alan zeminiyle kontrastı 2,40:1 (eşik 3:1). `:focus-visible` hiç yok. Açılır menülerin görünürlüğü `:hover`'a bağlı, klavyeyle açılmıyor. Yan menü kapalıyken yalnız ekran dışına kaydırılıyor; içindeki bağlantılar sekme sırasında kalıyor. |
| T-39 | Hareket | düzeltilmeli | `prefers-reduced-motion` hiç yok. Kartlarda yaylı büyüme (framer-motion), panolarda büyüme ve 3° dönme, tıklanmayan banner'da hover'da büyüme, sayfa değişiminde yumuşak kaydırma. |
| T-40 | Kontrast | değiştirilmeli | Turuncu üzerine beyaz metin: `#ff7f00` ve `#ff7f0e` 2,53:1 ("Teklif Al", "Mesaj Gönder", "Ziyaret Et"), `#f9a22e` 2,05:1, `orange` 1,97:1 ("Devamını Oku"). Beyaz zeminde turuncu hover metni 2,05:1; footer yasal bağlantıları (`#999`) 2,85:1. Panelin hata rengi `#e74c3c` 3,82:1, başarı rengi `#27ae60` 2,87:1. Metin için AA eşiği 4,5:1. Gövde metni uygun: açık gri zeminde `#333` 11,59:1, `#666` 5,27:1. Aynı turuncu üzerine koyu metin (`#333`) 4,99:1 ile eşiği geçiyor. |
| T-41 | Yakınlaştırma | değiştirilmeli | Görüntü alanı etiketi `maximum-scale=1.0, user-scalable=no`: mobilde yakınlaştırma kapalı. |

### 3.7 Mobil

| No | Ölçüt | Karar | Kanıt |
|---|---|---|---|
| T-42 | Menü eşiği | değiştirilmeli | Masaüstü menü 1550 px ve altında gizli (eski: `Header.module.scss`): 1024 ile 1536 arasındaki bütün dizüstü ekranlarda, planın masaüstü hedefi 1440'ta da menü hamburgerin içinde. |
| T-43 | İçerik genişliği | değiştirilmeli | Header, banner, öne çıkanlar, çalışma alanları, hizmetler, iletişim formu, yasal metinler, bölüm başlıkları ve footer her genişlikte %70: 390 px'te içerik yaklaşık 273 px, iki yanda toplam ~117 px boş. Hakkımızda, vizyon, projeler, referanslar ve ürünler mobilde %85–90'a genişliyor; aynı sayfada sol kenarlar kayıyor (projelerde başlık %70, kaydırıcı %90). Ortak bir kapsayıcı yok. |
| T-44 | Mobil menü | düzeltilmeli | Yan menü %60, %75 ya da %85 genişlikte; arkasında örtü yok; Esc ile kapanmıyor; kapalıyken odaklanılabiliyor (T-38); hamburger ve kapatma düğmesinin adı yok (T-35). |
| T-45 | Mobile uyarlanmış davranışlar | uygun | Önce/sonra kaydırıcı 768 px'in altında dikeye dönüyor; kategori sekmeleri mobilde ikişerli ve kaydırılabilir. Fikir doğru; klavye ve adlandırma düzeltilerek koruyorum. |
| T-46 | Öne çıkanlar ızgarası | doğrulanacak | Izgara 640 px'in altında tek sütunlu, panolar ise `grid-column: span 2` ile örtük ikinci bir sütun açıyor. Mobilde ızgaranın bozulduğunu düşünüyorum ama eski siteyi çalıştırmadığım için doğrulamadım. Yeni yapıda panolar ve öne çıkanlar ayrı bölümler olduğu için sorun taşınmıyor. |

### 3.8 Panelin bilgi mimarisi

| No | Ölçüt | Karar | Kanıt |
|---|---|---|---|
| T-47 | Grupların siteyi izlemesi | düzeltilmeli | Referans yönetimi "Kurumsal Ayarlar"da logo, ad ve iletişim bilgileriyle; hakkımızda ve vizyon "Site Ayarları"nda ana sayfa bloklarıyla; hizmetler ve projeler ayrı gruplarda. Bir içeriği bulmak için sitenin değil panelin kendi gruplamasını bilmek gerekiyor. |
| T-48 | Mesajlar | değiştirilmeli | Sitenin asıl çıktısı olan mesajlar menüde yok; "İstatistikler" ekranının sağ sütununda. Kayıtta gönderim tarihi var (`sent_at`) ama gösterilmiyor; silme onaysız; formdaki "Konu" panelde "Başlık". |
| T-49 | Gruplar ve gezinme | düzeltilmeli | Üç grup tek öğeli ("Hizmetler ▸ Hizmetleri Yönet", "Projeler ▸ Projeleri Yönet", "Entegrasyonlar ▸ Google Ads"); her biri bir fazla tıklama. Gruplar `li` tıklamasıyla açılıyor, düğmeyle değil; aynı anda tek grup açık; etkin sayfa işaretlenmiyor. |
| T-50 | Etiketler | düzeltilmeli | Fiil biçimleri karışık ("Logo Güncelleme", "Kategorileri Güncelle", "Hizmetleri Yönet", "Katalog Yükleme"); "Email" ve "E-posta" birlikte; "İsim Güncelleme" aslında şirket adını değiştiriyor; ekran başlığı "Hakkımızdayı Güncelle". Giriş formu "Kullanıcı Adı" diyor. |
| T-51 | Ekran başlıkları | düzeltilmeli | Logo (`h3`), referanslar, projeler, ürünler (`h2`), kategoriler, istatistikler (`h2` ve `h3`) ve giriş (`h2`) ekranlarında `h1` yok; diğer ekranlarda var. |
| T-52 | Görsel kimlik | düzeltilmeli | Panelde iki ayrı vurgu var: lacivert menü ve mavi giriş düğmesi, turuncu form düğmeleri. |

## 4. Koru, düzelt, değiştir

Öncelik: **Ö1** yapıyı ya da şemayı etkiliyor, ilgili fazın ilk PR'ından önce karar ve uygulama gerekiyor; **Ö2** sayfa ya da ekran PR'ında yapılıyor; **Ö3** son tur (Faz 8). "Plan" sütunu planın §7'sindeki maddeyi gösteriyor; "yeni" yazan madde plana bu incelemeyle giriyor.

### 4.1 Koruyacaklarım

| No | Ö | Madde | Plan | Bulgu |
|---|---|---|---|---|
| KR-01 | Ö1 | Sayfa seti ve her sayfanın içindeki bölüm sırası | Faz 6 sayfa maddeleri | T-06 |
| KR-02 | Ö1 | Ana sayfa blokları (banner, öne çıkanlar, tanıtım panoları, çalışma alanları) ve sınırlı adetli yuvalar | Faz 4 içerik şeması 3; Faz 6 ana sayfa; Faz 7 ana sayfa blokları | T-06 |
| KR-03 | Ö1 | Ürün ayrıntısından iletişim formuna ürün bilgisiyle geçiş | Faz 6 ürünler ve iletişim | T-19 |
| KR-04 | Ö1 | Ürünün teknik alanları: kod, renk, malzeme, güç, boyutlar | Faz 4 içerik şeması 2 | T-06 |
| KR-05 | Ö1 | Paletin rol yapısı: tek sıcak vurgu, koyu gri metin, açık gri zemin, beyaz yüzey (değerler değil) | Faz 5 token'lar | T-27 |
| KR-06 | Ö2 | Önce/sonra karşılaştırması ve mobilde dikey hali | Faz 6 projeler | T-45 |
| KR-07 | Ö2 | Kategoriye göre ürün listesi, en çok 8 sıralı kategori, mobilde kaydırılabilir sekmeler | Faz 6 ürünler | T-45 |
| KR-08 | Ö2 | İletişimde doğrudan telefon, e-posta ve WhatsApp bağlantıları | Faz 6 iletişim | T-24 |
| KR-09 | Ö2 | Paneldeki iş akışları: sabit yuvalı blok düzenleme, liste ve pencereyle ekleme ve düzenleme, silmeden önce onay | Faz 7 ekran maddeleri | T-47 |

### 4.2 Düzelteceklerim

| No | Ö | Madde | Plan | Bulgu |
|---|---|---|---|---|
| DZ-01 | Ö1 | İlk ekran: banner görseline iki dilli başlık (sayfanın tek `h1`'i; değer önermesi: kim, ne, kimin için) ve kısa açıklama; iki sabit eylem: "Ürünleri incele" ve "Bize ulaşın" | Faz 4 içerik şeması 3 (banner alanları); Faz 6 ana sayfa; Faz 7 ana sayfa blokları | T-01–T-03, T-13 |
| DZ-02 | Ö1 | Tanıtım panoları kataloglara açıkça bağlanır: panelde her pano için hedef katalog seçilir; ana sayfada "Kataloglar" başlıklı ayrı bölüm | Faz 4 içerik şeması 3; Faz 6 ana sayfa; Faz 7 ana sayfa blokları | T-18, T-21 |
| DZ-03 | Ö1 | Kataloglara iki dilli ad; adlı liste, dosya boyutuyla indirme bağlantısı, görüntüleyici §10'daki S-08 kararına göre | Faz 4 içerik şeması 2; Faz 6 kataloglar; Faz 7 kataloglar | T-22, T-36 |
| DZ-04 | Ö1 | Her sayfada tek `h1` ve sıralı başlıklar; bölüm başlığı tek bileşen; dekoratif yinelenen metin yok ya da ekran okuyucudan gizli | Faz 5 temel bileşenler 1; Faz 6 her sayfa | T-13–T-15, T-31 |
| DZ-05 | Ö1 | Ad tutarlılığı: menü etiketi, sayfa `h1`'i ve meta başlık aynı ad; Türkçe ve İngilizce adlar çift olarak belirlenir (§6.1); panel sitedeki adları kullanır | Faz 6 mesaj dosyaları ve sayfalar; Faz 7 | T-10, T-50 |
| DZ-06 | Ö1 | Ortak kapsayıcı: yüzde yerine en büyük genişlik ve kenar boşluğu; header, içerik ve footer aynı kapsayıcıda | Faz 5 temel bileşenler 1 | T-43 |
| DZ-07 | Ö1 | Kontrast: metin ve eylem renkleri AA (4,5:1); vurgu üzerinde beyaz metin eşiği geçmiyorsa düğme metni koyu ya da vurgunun koyu tonu | Faz 5 token'lar | T-40 |
| DZ-08 | Ö1 | Erişilebilirlik işaretlemesi: her sayfada `main` ve içeriğe atlama; tıklanabilir öğeler düğme ya da bağlantı; adlı ikon denetimleri; yakınlaştırma açık | Faz 5 temel bileşenler; Faz 6 site düzeni ve her sayfa | T-33–T-35, T-41 |
| DZ-09 | Ö1 | Panel menüsü sitenin yapısını izler (§6.5); tek öğeli grup yok; gruplar düğmeyle açılır; etkin sayfa işaretli | Faz 7 panel düzeni | T-47, T-49 |
| DZ-10 | Ö2 | Header: masaüstü menü 1024 px'ten itibaren; mobil menü adlı bir düğmeyle açılır, kapalıyken odaklanılamaz, Esc ve örtüyle kapanır | Faz 5 temel bileşenler 3; Faz 6 site düzeni | T-42, T-44 |
| DZ-11 | Ö2 | Footer: site bağlantı grupları; tıklanabilir telefon ve e-posta; adlı sosyal bağlantılar; tutarlı yasal sayfa adları | Faz 6 site düzeni | T-10, T-24 |
| DZ-12 | Ö2 | İletişim: görünür etiketler; ürün bilgisi formda görünür ve silinebilir bir alan; adres ve çalışma saatleri sayfada; gönderim sonucu canlı bölgede; kısa ve sektöre uygun bir giriş metni | Faz 6 iletişim | T-16, T-37 |
| DZ-13 | Ö2 | Hizmetler: `h1` ve bir giriş cümlesi; açıklamalar sayfada, pencere yok; sayfa sonunda iletişim eylemi | Faz 6 hizmetler | T-13, T-16, T-23 |
| DZ-14 | Ö2 | Projeler ve referanslar: proje başlığı `h2`; görsellerin alternatif metni proje başlığından; referanslar düğme ya da bağlantı; dış bağlantı yalnız adres varsa; tek sayfada sayfalama gösterilmez; iki sayfanın sonunda iletişim eylemi | Faz 6 projeler ve referanslar | T-14, T-23, T-34, T-36 |
| DZ-15 | Ö2 | Hakkımızda: uzun metin sola hizalı paragraflar (biçim S-05'e göre) | Faz 6 hakkımızda | T-17 |
| DZ-16 | Ö2 | 404 ve hata sayfası site düzeni içinde; açıklayıcı `h1`; ana bölümlere bağlantılar | Faz 6 site düzeni | T-12, T-24 |
| DZ-17 | Ö2 | Alternatif metinler içerikten: ürün adı, proje başlığı ile önce/sonra, katalog adı ile sayfa numarası; doldurulmamış yer tutucu yok | Faz 6 her sayfa | T-36 |
| DZ-18 | Ö2 | Site haritası veriden: bütün sayfalar ve ürün sayfaları; manifest satış kategorisi taşımaz | Faz 5 manifest; Faz 6 SEO | T-12 |
| DZ-19 | Ö2 | Panel ekranlarında tek `h1` ve etiketli alanlar; giriş formu "E-posta" der | Faz 7 her ekran | T-50, T-51 |
| DZ-20 | Ö2 | Mesajlar panel menüsünde ayrı öğe; gönderim tarihi görünür; silme onaylı; "Konu" her yerde aynı ad | Faz 7 mesajlar | T-48 |
| DZ-21 | Ö3 | Hareket: hover'da renk ve gölge, ölçek ve dönme yok; `prefers-reduced-motion` | Faz 5 token'lar; Faz 8 erişilebilirlik | T-39 |
| DZ-22 | Ö3 | Panel sitenin token'larını kullanır; tek vurgu | Faz 5 token'lar; Faz 7 | T-52 |

### 4.3 Değiştireceklerim

| No | Ö | Madde | Plan | Bulgu |
|---|---|---|---|---|
| DG-01 | Ö1 | Menü: Ürünler başta; açılır menü yok; "Ana sayfa" bağlantısı yok (logo); Referanslar üst seviyede; sıra §6.1'de | Faz 6 site düzeni; karar S-11 | T-07, T-08 |
| DG-02 | Ö1 | Vizyon, Hakkımızda sayfasında bir bölüm; ayrı sayfa yok | Faz 6 hakkımızda; karar S-12 | T-09 |
| DG-03 | Ö1 | Ürün ayrıntısı pencere değil, kendi adresi olan bir sayfa; "Kategoriler" sayfasının adı "Ürünler" | Faz 4 içerik şeması 2 (adres anahtarı); Faz 6 ürünler; karar S-13 | T-09, T-12 |
| DG-04 | Ö1 | Öne çıkanlar ürün kayıtlarından seçilir ve ürün sayfasına gider; ayrı görsel yükleme kalkar | Faz 4 içerik şeması 3; Faz 6 ana sayfa; Faz 7 ana sayfa blokları; karar S-14 | T-20 |
| DG-05 | Ö1 | Ürün eyleminin adı "Bilgi iste"; ayrı bir teklif sayfası yok | Faz 6 ürünler; karar S-15 | T-24 |
| DG-06 | Ö1 | Adres dili: Türkçe sayfalar `/tr/…` altında Türkçe, İngilizce sayfalar `/en/…` altında İngilizce adreslerle | ADR 0006; Faz 3 iskelet; karar S-16 | T-11 |
| DG-07 | Ö2 | Öneri (sektör normu, mevcut veriden): ana sayfada "Projeler ve referanslar" bölümü (son projeler ve referans logoları) ve sayfa sonunda kısa bir iletişim bandı; panelde yeni ekran yok | Faz 6 ana sayfa (yeni); karar S-17 | T-04, T-23 |
| DG-08 | Ö2 | Öneri: "İletişim" menünün son öğesi olarak düğme görünümünde | Faz 6 site düzeni (yeni) | T-03, T-24 |
| DG-09 | Ö1 | Stil sistemi: eski SCSS ve Tailwind 3 karışımı alınmaz; token'lar §5'teki başlangıç değerlerinden | Faz 5 token'lar (planda var) | T-25–T-32 |

## 5. Başlangıç token seti

Eski sitenin SCSS'inden ölçtüğüm değerler ve onlardan çıkardığım başlangıç seti. Faz 5'te yeni markanın logosu, rengi ve yazı tipi gelince bu değerleri uyarlarım; burada sabitlediğim şey değerler değil, ölçeklerin boyu ve rollerin listesi. Adlar Tailwind CSS 4'ün `@theme` ad alanlarına göre ([ADR 0005](../adr/0005-stil-tailwind-css-4.md)).

### 5.1 Renk rolleri

| Rol | Eski değer (sitede kullanım sayısı) | Başlangıç |
|---|---|---|
| Metin | `#333333` (31) | `--color-ink`: `#333333` (açık gri zeminde 11,59:1) |
| İkincil metin | `#666666` (24) | `--color-ink-muted`: `#666666` (5,27:1; bundan açığı metinde kullanılmaz) |
| Sayfa zemini | `#f5f5f5` (13) | `--color-canvas`: `#f5f5f5` |
| Yüzey (kart, form) | `#ffffff` (24) | `--color-surface`: `#ffffff` |
| Vurgu | `#ff7f00` (17), `#f9a22e` (13) ve 5 ton daha | `--color-accent` ve `--color-accent-strong` (hover ve vurgulu metin); değerler yeni markadan; vurgu üzerindeki metin 4,5:1'i sağlar |
| Kenarlık | `#cccccc`, `#dddddd`, `#eeeeee` | `--color-line` (tek değer) |
| Hata, başarı | panelde `#e74c3c` (40), `#27ae60` (15); sitede Tailwind'in kırmızı ve yeşili | `--color-danger`, `--color-success`; beyaz zeminde 4,5:1'i geçen tonlar |
| Örtü | `rgba(0,0,0,0.6)` | `--color-scrim` |

Varsayılan Tailwind paleti `--color-*: initial` ile kapatılırsa (ADR 0005'in açık kalanı) bu liste paletin tamamı olur.

### 5.2 Tipografi

| Konu | Eski | Başlangıç |
|---|---|---|
| Aile | Nunito (400, 700); header'da etkisiz `Arial` | yeni markanın yazı tipi, `next/font` ile tek aile; `--font-sans` `@theme inline` ile |
| Boyut | 24 farklı (en sık 16 px ×19, 24 px ×11, 14,4 px ×10, 14 px ×9, 19,2 px ×8) | Tailwind'in varsayılan 9 adımı yeterli: `--text-xs` 12, `sm` 14, `base` 16, `lg` 18, `xl` 20, `2xl` 24, `3xl` 30, `4xl` 36, `5xl` 48 px. Eski değerler en yakın adıma gider (12,8–13,6 → 14; 17,6–19,2 → 18; 22,4–25,6 → 24; 28–32 → 30; 38,4–48 → 36 ya da 48). |
| Ağırlık | 500, 600, 700, 800 yazılmış; 400 ve 700 yüklü | `--font-weight-normal` 400, `semibold` 600 (yazı tipinde varsa), `bold` 700 |
| Satır yüksekliği | 1,6 (×7), 1,8 (×4), 1,3, 1,2 | gövde 1,6; başlık 1,2–1,3 |
| Sayfa başlığı | `clamp(1.75rem, 3vw, 3rem)` | `h1` mobilde `3xl`, 1024 px'ten itibaren `5xl` |

### 5.3 Boşluk, köşe, gölge, katman, hareket

| Konu | Eski | Başlangıç |
|---|---|---|
| Boşluk | 25 farklı değer; en sık 16 (×47), 8 (×29), 32 (×20), 24 (×19), 20 (×14) px | `--spacing: 0.25rem` (4 px taban, Tailwind varsayılanı); kullanılan adımlar 4, 8, 12, 16, 24, 32, 48, 64, 80 px. 10, 15, 25, 30 ve 35 px en yakın adıma gider; boşlukta `vh` yok. |
| Bölüm aralığı | 64 px (`4rem`, ×6) | mobilde 48, 1024 px'ten itibaren 80 px |
| Köşe | 9 değer; en sık 8 px (×15) | `--radius-sm` 4, `--radius-md` 8, `--radius-lg` 12 px ve tam yuvarlak |
| Gölge | 14 değer, hepsi siyahın %10–30'u | üç değer: `--shadow-sm` `0 2px 4px rgb(0 0 0 / 0.1)`, `--shadow-md` `0 4px 12px rgb(0 0 0 / 0.1)`, `--shadow-lg` `0 8px 24px rgb(0 0 0 / 0.15)` |
| Katman | 0, 1, 2, 10, 999, 1000, 9999 | üç seviye: içerik, header (10), örtü ve iletişim kutusu (50) |
| Hareket | 0,2, 0,3, 0,4 s; iki eğri | iki süre (150 ve 300 ms, `duration-*` sınıflarıyla; Tailwind 4'te süre için ad alanı yok), tek eğri (`--ease-out`); `prefers-reduced-motion`'da geçiş yok |

### 5.4 Kesme noktaları ve kapsayıcı

| Konu | Eski | Başlangıç |
|---|---|---|
| Kesme noktaları | 14 genişlik ve üç ayrı sistem | 390 tasarım tabanı (mobil önce; kesme noktası değil); `--breakpoint-md` 48rem (768), `--breakpoint-lg` 64rem (1024), `--breakpoint-xl` 90rem (1440). Tailwind'in varsayılan `sm` ve `2xl`'i kapatılır. |
| Masaüstü menü | 1550 px'ten geniş ekranlarda | `lg` (1024) ve üstü |
| Kapsayıcı | her genişlikte %70 (1440'ta 1008 px); bazı bölümlerde %50, %85, %90 | tek kapsayıcı: en çok 1200 px; kenar boşluğu 16 px, `md`'de 24, `lg`'de 32 px |

## 6. Tanyeri için önerdiğim hiyerarşi

Eski sayfa seti ve bölüm sıraları korunuyor; değişenler §4'teki maddeler. Menü, adlar ve ana sayfa bölümleri S-11–S-17 kararlarıma bağlı; aşağıdaki hal önerim.

### 6.1 Ana menü ve sayfa adları

Sıranın mantığı: önce ne sunduğum (ürünler, kataloglar, hizmetler), sonra kanıtı (projeler, referanslar), sonra kim olduğum, en sonda iletişim. Açılır menü yok. Yedi öğenin dil seçiciyle birlikte 1024 px'te tek satıra sığması gerekiyor; bunu Faz 6'da iki dilde görsel kontrolle doğrularım, sığmazsa masaüstü menü eşiği yükselir.

| Sıra | Türkçe | İngilizce | Önerilen adres (S-16) | Eski karşılığı |
|---|---|---|---|---|
| logo | Ana sayfa | Home | `/tr`, `/en` | `/` |
| 1 | Ürünler | Products | `/tr/urunler`, `/en/products` | Kategoriler (`/categories`) |
| — | ürün adı | ürün adı | `/tr/urunler/[ürün]`, `/en/products/[ürün]` | ürün penceresi |
| 2 | Kataloglar | Catalogs | `/tr/kataloglar`, `/en/catalogs` | Kataloglar |
| 3 | Hizmetler | Services | `/tr/hizmetler`, `/en/services` | Hizmetler |
| 4 | Projeler | Projects | `/tr/projeler`, `/en/projects` | Projeler |
| 5 | Referanslar | References | `/tr/referanslar`, `/en/references` | Kurumsal ▸ Referanslarımız |
| 6 | Hakkımızda | About | `/tr/hakkimizda`, `/en/about` | Kurumsal ▸ Hakkımızda ve Vizyonumuz |
| 7 | İletişim (düğme görünümü) | Contact | `/tr/iletisim`, `/en/contact` | İletişim |
| footer | Gizlilik ve Çerez Politikası | Privacy and Cookie Policy | `/tr/gizlilik`, `/en/privacy` | Gizlilik |
| footer | Kullanım Şartları | Terms of Use | `/tr/kullanim-sartlari`, `/en/terms` | Şartlar ve Koşullar |

Sayfa adlarında iyelik eki yok ("Projelerimiz" değil "Projeler"); menü etiketi, `h1` ve meta başlık aynı. Ürün adresindeki `[ürün]` dilden bağımsız bir anahtar; biçimi Faz 4'teki içerik şeması 2'de belirlenir (eski sitede ürün kodu isteğe bağlıydı, anahtar olamaz).

### 6.2 Ana sayfa

| Sıra | Bölüm | İçerik | Eylem | Kaynak |
|---|---|---|---|---|
| 1 | İlk ekran (`h1`) | banner görseli; değer önermesi (tek cümle: kim, ne, kimin için); kısa açıklama | "Ürünleri incele" → Ürünler; "Bize ulaşın" → İletişim | eski banner ve yeni metin alanları (DZ-01) |
| 2 | Öne çıkan ürünler (`h2`) | 6 ürün kartı | kart → ürün sayfası; "Tüm ürünler" | eski öne çıkanlar (DG-04) |
| 3 | Kataloglar (`h2`) | 3 tanıtım panosu | pano → seçili katalog; "Tüm kataloglar" | eski tanıtım panoları (DZ-02) |
| 4 | Uygulama alanları (`h2`) | 6 kart: görsel, başlık, açıklama | yok | eski çalışma alanları, yeni adıyla |
| 5 | Projeler ve referanslar (`h2`, öneri) | son 3 proje ve referans logoları | "Tüm projeler", "Tüm referanslar" | mevcut veri (DG-07) |
| 6 | İletişim bandı (öneri) | tek cümle | "Bize ulaşın" | arayüz metni (DG-07) |

### 6.3 Sayfa iskeletleri

| Sayfa | `h1` | Bölümler | Sayfa sonu eylemi |
|---|---|---|---|
| Ürünler | Ürünler | kategori sekmeleri; seçili kategorinin adı (`h2`); ürün kartları (`h3` ürün adı) | Kataloglar, Bize ulaşın |
| Ürün | ürün adı | görsel; teknik özellikler (tanım listesi: kod, renk, malzeme, güç, boyutlar) | "Bilgi iste" → İletişim, ürün bilgisiyle |
| Kataloglar | Kataloglar | katalog kartları (`h2` katalog adı; kapak; görüntüle; indir) | Bize ulaşın |
| Hizmetler | Hizmetler | giriş; 4 hizmet (`h2`, görsel, açıklama, ek açıklama) | Bize ulaşın |
| Projeler | Projeler | giriş; projeler (`h2` başlık, önce/sonra, açıklama) | Bize ulaşın |
| Referanslar | Referanslar | logo ve ad listesi; açıklama ve web adresi | Projeler, Bize ulaşın |
| Hakkımızda | Hakkımızda | hakkımızda metni; Vizyonumuz (`h2`) | Hizmetler, Bize ulaşın |
| İletişim | İletişim | iletişim bilgileri (`h2`: telefon, e-posta, WhatsApp, adres, çalışma saatleri); form (`h2`) | form |
| Yasal sayfalar | sayfa adı | bölümler (`h2`) | yok |
| 404 | Sayfa bulunamadı | ana bölümlere bağlantılar | Ana sayfa |

### 6.4 Footer

- **Ürünler:** kategoriler (en çok 8).
- **Kurumsal:** Hakkımızda, Hizmetler, Projeler, Referanslar, Kataloglar.
- **İletişim:** adres, telefon (`tel:`), e-posta (`mailto:`), çalışma saatleri.
- **Sosyal:** adı yazılı bağlantılar.
- **Alt satır:** telif, Gizlilik ve Çerez Politikası, Kullanım Şartları.

### 6.5 Panel menüsü

Gruplar sitenin sırasını izliyor; tek öğeli grup yerine düz bağlantı.

| Sıra | Öğe | İçerik | Eski karşılığı |
|---|---|---|---|
| 1 | Genel bakış | ziyaret istatistikleri; Google Ads özeti (yapılandırılmışsa) | İstatistikler |
| 2 | Mesajlar | liste, tarih, yanıt, onaylı silme | İstatistikler ekranının içi |
| 3 | Ana sayfa ▸ Banner, Öne çıkan ürünler, Tanıtım panoları, Uygulama alanları | bloklar | Site Ayarları'nın bir kısmı |
| 4 | Ürünler ▸ Kategoriler ve ürünler, Kataloglar | | Ürünler |
| 5 | Hizmetler | | Hizmetler ▸ Hizmetleri Yönet |
| 6 | Projeler | | Projeler ▸ Projeleri Yönet |
| 7 | Referanslar | | Kurumsal Ayarlar ▸ Referans Yönetimi |
| 8 | Sayfalar ▸ Hakkımızda ve vizyon, Gizlilik, Kullanım şartları, Sayfa bilgileri | sayfa bilgileri: meta veri | Site Ayarları'nın bir kısmı; yasal sayfalar ve meta veri D3 ile yeni |
| 9 | Ayarlar ▸ Kurumsal bilgiler, Hesabım, Google Ads | kurumsal bilgiler tek ekranda (ad, logo, iletişim, çalışma saatleri, sosyal medya); hesap: e-posta ve şifre; Google Ads yalnız yapılandırılmışsa | Kurumsal Ayarlar, Yönetici Ayarları, Entegrasyonlar |

## 7. Karar bekleyenler

Gerekçeleri §3 ve §4'te. Numaralar planın §10'undaki açık soruların devamı.

| No | Soru | Önerim |
|---|---|---|
| S-11 | Ana menü: §6.1'deki düz, yedi öğeli sıra mı, eski gruplu yapı (Kurumsal ▾, Ürünler ▾) yalnız sırası değişerek mi? | Düz menü |
| S-12 | Vizyon ayrı bir sayfa mı, Hakkımızda'da bir bölüm mü? | Bölüm |
| S-13 | Ürün ayrıntısı pencere mi, kendi adresi olan bir sayfa mı? | Sayfa |
| S-14 | Öne çıkanlar ayrı yüklenen görsel ve başlık mı, ürün kayıtlarından seçim mi? | Ürünlerden seçim |
| S-15 | Ürün eyleminin adı "Teklif al" mı, "Bilgi iste" mi; ayrı bir teklif sayfası olsun mu? | "Bilgi iste"; ayrı sayfa yok |
| S-16 | Adresler iki dilde de İngilizce mi (`/tr/products`), her dil kendi dilinde mi (`/tr/urunler`, `/en/products`)? | Her dil kendi dilinde |
| S-17 | Ana sayfaya mevcut veriden "Projeler ve referanslar" bölümü ve kapanış iletişim bandı eklensin mi (eski sitede yoktu)? | Evet |

## Kaynaklar

- Eski kod (yalnız yerelde, salt okunur): `src/pages/**`, `src/components/**`, `src/layouts/**`, `src/styles/**`, `seo.json`, `src/lib/config/*.ts`, `public/robots.txt`, `public/sitemap.xml`, `public/site.webmanifest`
- [Revizyon planı](../plans/2026-10-27-revizyon.md), [vizyon](../vision.md), [ADR 0005](../adr/0005-stil-tailwind-css-4.md), [ADR 0006](../adr/0006-cok-dillilik-next-intl.md), [teknoloji doğrulaması](2026-10-28-teknoloji-dogrulamasi.md)
- https://www.pelsan.com.tr/
- https://www.eaeaydinlatma.com/
- https://www.horozelektrik.com/
- https://www.iguzzini.com/
- https://www.deltalight.com/en
- https://www.arkoslight.com/en
- https://www.louispoulsen.com/en/professional
- https://tailwindcss.com/docs/theme (ad alanları, varsayılan yazı boyutları ve kesme noktaları)
- https://next-intl.dev/docs/routing/configuration (yerelleştirilmiş adresler, `pathnames`)
- https://www.w3.org/TR/WCAG22/ (1.4.3 kontrast, 1.4.4 metni yeniden boyutlandırma, 1.4.11 metin dışı kontrast, 2.4.1 blokları atlama, 2.4.7 odak görünürlüğü, 4.1.2 ad, rol, değer)
