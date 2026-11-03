// The demo articles of the Blog page: the text of each article as written, in both languages. The days are fixed, so
// a second seed run leaves the same rows. The addresses in the texts are pages of the demo content.
export interface DemoBlogPost {
  slug: string;
  publishedAt: Date;
  imageUrl: string;
  title: { tr: string; en: string };
  description: { tr: string; en: string };
  excerpt: { tr: string; en: string };
  imageAlt: { tr: string; en: string };
  body: { tr: string; en: string };
}

export const demoBlogPosts: DemoBlogPost[] = [
  {
    slug: 'ray-spot-nerelerde-kullanilir',
    publishedAt: new Date('2026-06-09T00:00:00.000Z'),
    imageUrl: '/demo/product-cob-spot.webp',
    title: {
      tr: 'Ray spot nerelerde kullanılır? Türleri ve planlama',
      en: 'Where are track spots used? Types and planning',
    },
    description: {
      tr: 'Ray spot; mağaza, galeri, salon ve ofis gibi vurgu ışığı gereken yerlerde kullanılır. Ray türlerini, manyetik rayı, planlamayı ve güvenlik noktalarını anlattık.',
      en: 'Track spots suit shops, galleries, living rooms and offices where you need adjustable accent light. See track types, magnetic track, layout and safety basics.',
    },
    excerpt: {
      tr: 'Ray spot, spotların rayda kaydırılıp yönlendirilebildiği esnek bir sistemdir. Nerede işe yaradığını, ray türlerini ve planlarken dikkat edilecekleri özetledik.',
      en: 'A track spot can slide along a rail and turn to any target. Here is where it works, how the track types differ, and what to plan and check before installing.',
    },
    imageAlt: {
      tr: 'Beyaz gövdeli, yuvarlak ve derin reflektörlü bir COB spot armatür',
      en: 'A white round COB spot luminaire with a deep reflector',
    },
    body: {
      tr: `Ray spot, spotların bir ray üzerinde kaydırılıp istenen yöne çevrilebildiği aydınlatma sistemidir. Eşyaların, rafların veya duvarın yeri değiştiğinde spotu yeniden delik açmadan taşırsınız. Bu esneklik yüzünden en çok mağaza, galeri, sergi alanı ve açık planlı yaşam alanlarında kullanılır.

## Nerelerde iyi çalışır?

- **Mağaza ve vitrinler:** Ürün düzeni sık değişir. Spotu ürüne yönlendirmek yeterlidir.
- **Galeri ve sergi alanları:** Tablo ve objeler dar bir ışık huzmesiyle vurgulanır.
- **Salon ve mutfak:** Duvar, kitaplık veya sanat eseri için yönlendirilebilir ışık verir.
- **Ofis ve toplantı odaları:** Duvardaki panoyu veya sunum alanını aydınlatır. Masa üstü genel ışık için ayrıca panel ya da lineer armatür gerekir.
- **Kafe ve restoranlar:** Masa üstlerine ve servis noktalarına ışık verir.

Ray spot genel aydınlatmanın yerini tek başına almak için pek uygun değildir. Çoğu zaman vurgu katmanı olarak, tavan aydınlatmasının yanına eklenir.

## Ray türleri

**Tek faz, 230 V ray.** Şebeke gerilimiyle doğrudan çalışır, trafo gerekmez. Montajı görece basittir. Daha yüksek güçlü spotlar ve yüksek tavanlar için uygundur.

**Üç faz, 230 V ray.** Aynı ray içinde üç ayrı devre barındırır. Her spotun adaptörüyle hangi devreye bağlanacağı seçilir, böylece spot grupları ayrı yakılıp söndürülebilir. Montajı daha karmaşıktır ve yetkili elektrikçi gerektirir.

**48 V manyetik ray.** Spotlar mıknatısla ray'a tutunur; yerini değiştirmek için alet gerekmez. Sistem düşük gerilimlidir (SELV) ve ayrı bir trafo ile beslenir. Trafoya erişilebilir bir yer ayırmak gerekir. Ray ince olduğundan görüntüsü sadedir. Ürün seçeneği 230 V raya göre dardır ve maliyet genellikle daha yüksektir.

## Nasıl planlanır?

1. **Amacı belirleyin.** Vurgu mu, genel ışık mı gerekiyor? Vurgu için dar huzme, geniş alan için geniş huzme seçilir.
2. **Ray yolunu çizin.** Ray, aydınlatmak istediğiniz yüzeye paralel gitsin. Elektrik besleme noktasını ve ray uçlarını önceden belirleyin.
3. **Huzme çapını hesaplayın.** Spotun yere veya duvara düşürdüğü ışık dairesi, mesafe × 2 × tan(huzme açısı / 2) kadardır. Örnek: 24 derecelik spot, 2,5 m uzaktan yaklaşık 1,06 m çapında bir daire oluşturur.
4. **Spot sayısını belirleyin.** Her hedef için bir spot düşünün. Işık düzeyini ürünün fotometrik tablosundan kontrol edin.
5. **Kamaşmayı kontrol edin.** Spotlar göz hizasına bakmamalı. Kamaşma çok olursa derin reflektörlü veya ızgara korumalı modeller seçin.

Ray tek parça olarak belirli bir uzunluğa kadar gelir; sınır üreticiye göre değişir. Daha uzun hatlar ek parçalarla kurulur.

## Işık rengi ve kalite

Vurgu ışığında renk geriverimi önemlidir. Ürünün ya da tablonun rengi doğru görünsün istiyorsanız yüksek Ra değerli spot seçin. Aynı rayda farklı renk sıcaklığında spotlar kullanmak, duvarda leke gibi görünebilir. Bu yüzden bir mekanda tek renk sıcaklığına bağlı kalmak daha düzenli bir sonuç verir.

## Temel güvenlik

- 230 V rayda montaj ve bağlantıyı yetkili elektrikçiye yaptırın. Üç fazlı sistemde bu daha da önemlidir.
- Rayın ve trafonun taşıyabileceği toplam gücü üreticinin belgesinden kontrol edin. Toplam spot gücü bu sınırı aşmamalı.
- 48 V sistemde trafoyu havalandırılabilen ve bakım için erişilebilen bir yere koyun.
- Ray ve spotları üreticinin birlikte tanımladığı sistemde kullanın. Farklı markaların adaptörleri çoğu zaman uyumlu değildir.
- Raya yük bindirmeyin, yalnızca ışık armatürü asın.
- Montaj sırasında ilgili devrenin sigortasını kapatın.

Plan aşamasında hem mevcut elektrik tesisatını hem tavan yapısını bilmek işi kolaylaştırır.

Demo sitemizdeki [ray spot ürünlerine](/tr/urunler?category=ray-spot) göz atabilir, projeniz için [iletişim sayfasını](/tr/iletisim) kullanabilirsiniz.`,
      en: `Track spots are spotlights that slide along a rail and can be turned toward any target. When shelves, displays or furniture change, you move the spot instead of cutting new holes. That flexibility is why they appear mostly in shops, galleries, exhibition areas and open-plan homes.

## Where they work well

- **Shops and windows:** the layout changes often, so you aim the spot at the product.
- **Galleries and exhibitions:** a narrow beam picks out paintings and objects.
- **Living rooms and kitchens:** adjustable light for a wall, a bookcase or an artwork.
- **Offices and meeting rooms:** light for a notice board or a presentation wall. Desk light still needs a general source such as a panel or a linear luminaire.
- **Cafes and restaurants:** light for tables and serving points.

A track spot is rarely the only light in a room. Most often it is the accent layer next to the main ceiling lighting.

## Track types

**Single-phase 230 V.** It runs from mains voltage with no transformer. Installation is relatively simple. It suits higher-power spots and high ceilings.

**Three-phase 230 V.** One rail carries three separate circuits. An adapter on each spot decides which circuit it uses, so you can switch groups of spots separately. Installation is more complex and calls for a qualified electrician.

**48 V magnetic.** Spots hold on to the rail with magnets, and you can move them without tools. It is a low-voltage system (SELV) fed by a separate transformer, so you need accessible space for the transformer. The rail is slim and looks clean. The range of fittings is narrower than for 230 V track, and the cost is usually higher.

## How to plan

1. **Define the purpose.** Accent or general light? Use a narrow beam for accents and a wide beam for larger areas.
2. **Draw the track route.** Run the track parallel to the surface you want to light. Decide the power feed point and the track ends early.
3. **Work out the beam size.** The diameter of the light circle is 2 × distance × tan(beam angle ÷ 2). Example: a 24 degree spot at 2.5 m makes a circle about 1.06 m wide.
4. **Decide the number of spots.** Think of one spot per target. Check light levels in the maker's photometric table.
5. **Check glare.** Spots should not point at eye level. If glare is a problem, choose models with a deep reflector or a louvre.

A track comes in single pieces up to a certain length, and the limit depends on the maker. Longer runs use connectors.

## Basic safety

- Have a qualified electrician install and connect a 230 V track. This matters even more for three-phase systems.
- Check the maximum load of the track and transformer in the maker's documents. The total spot power must stay below it.
- With a 48 V system, put the transformer where it has airflow and can be reached for service.
- Use the track and spots as one system from the same maker. Adapters from different brands often do not fit.
- Do not hang anything but light fittings on the track.
- Switch off the circuit at the fuse before you work on it.

Know your wiring and ceiling structure at the planning stage. It saves time later.

You can look at the [track spot range](/en/products?category=ray-spot) in the demo shop, and use the [contact page](/en/contact) for your project.`,
    },
  },
  {
    slug: 'lineer-aydinlatma-nedir',
    publishedAt: new Date('2026-07-07T00:00:00.000Z'),
    imageUrl: '/demo/product-kare-sarkit.webp',
    title: {
      tr: 'Lineer aydınlatma nedir? Türleri ve seçim rehberi',
      en: 'What is linear lighting? Types and how to choose',
    },
    description: {
      tr: 'Lineer aydınlatma, tek bir sürekli ışık çizgisiyle çalışan sistemdir. Sarkıt, sıva üstü ve gömme türlerini ve boyut ile ışık akısı seçimini anlatıyoruz.',
      en: 'Linear lighting gives light as one continuous line instead of separate points. Learn the suspended, surface and recessed types, and how to pick size and output.',
    },
    excerpt: {
      tr: 'Lineer aydınlatma, noktasal ışık yerine uzun ve kesintisiz bir ışık çizgisi kullanır. Türlerini, uygun mekanları ve doğru boyutu nasıl seçeceğinizi özetledik.',
      en: 'Linear lighting spreads light along a long, unbroken line instead of a single point. Here are the main types, where they work well and how to choose length and output.',
    },
    imageAlt: {
      tr: 'Siyah çerçeveli, kare formda bir lineer sarkıt armatür, ince askı telleriyle tavandan sarkıyor',
      en: 'A black-framed square linear pendant luminaire hanging from a ceiling on thin suspension wires',
    },
    body: {
      tr: `Lineer aydınlatma, ışığı noktalar yerine uzun ve kesintisiz bir çizgi halinde veren armatür sistemidir. Genellikle ince bir alüminyum profil ile onun içindeki LED şeritten oluşur. Işık tek bir noktada toplanmaz, çizgi boyunca yayılır.

## Nerelerde işe yarar?

Uzun ve düzenli mekanlarda iyi sonuç verir. Koridorlar, açık ofisler, mağaza reyonları ve mutfak adaları bunların başında gelir. Evde de salonda ya da yemek masasının üstünde kullanılır. Profiller ölçüye göre üretildiği için uzunluğu, ışık rengini ve kaplamayı mekana göre belirleyebilirsiniz.

Tek bir tabloyu ya da rafı vurgulamak içinse spot daha uygundur. Vurgu gereken yerde lineer sistemi spot ile birlikte kurmak mantıklı olabilir.

## Üç ana tür

**Sarkıt lineer.** Tavandan tellerle asılır. Işık hem aşağı hem yukarı verilebilir. Yüksek tavanlı ofislerde ve restoranlarda tercih edilir, çünkü ışık kaynağı çalışma düzlemine yaklaşır.

**Sıva üstü lineer.** Tavana veya duvara doğrudan vidalanır. Alçak tavanlarda yer kaplamaz ve montajı basittir. Tavanı delmek istemediğiniz yenileme işlerinde işinizi görür.

**Gömme lineer.** Profil tavan ya da duvarın içine yerleştirilir ve yüzey düz kalır. Sıvaya veya asma tavana önceden açıklık bırakmak gerekir. Bazı ürünlerde açıklık, profil ölçüsünden birkaç milimetre fazla olmalıdır. Kesimden önce üreticinin montaj çizimine bakın.

## Boyut nasıl seçilir?

Önce mekanın uzunluğuna ve tavan yüksekliğine bakın. Profili tek parça seçebilir ya da modülleri uç uca ekleyerek sürekli bir hat kurabilirsiniz. Ek yerlerinde difüzörün parlaklığı farklı görünebilir. Bu yüzden üreticiler kesintisiz hat için aynı seriden modül önerir.

Parlaklığı lümen cinsinden düşünün. Katalogda ışık akısı çoğu zaman armatür başına verilir, metre başına değil. Ürünleri karşılaştırmak için toplam lümeni uzunluğa bölün. Aynı renk sıcaklığı ve aynı watt için verilmiş değerleri kıyaslayın.

Gereken toplam ışık akısını kabaca şöyle bulabilirsiniz:

- Hedef aydınlık düzeyini (lüks) alana (m²) çarpın.
- Sonucu, armatürün ışığının ne kadarının çalışma düzlemine ulaştığını gösteren katsayıya bölün.

Örnek (varsayımsal): 20 m² bir ofiste 500 lüks hedefleniyor. 500 × 20 = 10.000 lm gerekir. Katsayı 0,6 kabul edilirse toplam yaklaşık 16.700 lm eder. Gerçek katsayı tavan, duvar rengi ve armatür tipine göre değişir. Kesin hesap için üreticinin fotometrik verisini kullanın.

## Işığın yönü

Lineer armatür ışığı yalnızca aşağı vermek zorunda değildir. Sarkıt modellerde ışık hem aşağı hem tavana doğru verilebilir. Tavana giden ışık, mekanı yumuşak ve dengeli aydınlatır. Aşağı giden ışık ise masa ve tezgah gibi çalışma yüzeylerine yeter. İki yönlü bir modelde bu iki payı ayrı ayrı sormak iyi olur.

## Göz kamaşması ve difüzör

Ofis gibi ekranla çalışılan yerlerde kamaşma önemlidir. Düşük kamaşmalı lineer ürünlerin birçoğu mikroprizmatik difüzör kullanır ve UGR değerini 19'un altında tutar. Ürün sayfasında UGR değerinin hangi koşulda ölçüldüğüne bakın. Aynı armatür farklı odada farklı UGR verebilir.

## Renk sıcaklığı ve kısma

Lineer sistemde ışık uzun bir yüzeyden geldiği için renk farkı kolay fark edilir. Aynı hatta farklı partilerden modül kullanmamaya dikkat edin. Sistemin kısılması gerekiyorsa sürücünün kısma yöntemini (örneğin 1-10 V veya DALI) ürün belgesinden kontrol edin.

## Seçerken kısa kontrol listesi

- Mekanın uzunluğu ve tavan yüksekliği
- Sarkıt, sıva üstü veya gömme montaj
- Toplam lümen ve renk sıcaklığı (ofiste 3000 K ile 4000 K arası yaygındır)
- Kamaşma sınırı ve difüzör tipi
- Kısılabilir sürücü gerekiyor mu
- Ek yerlerinin görünümü

Karar vermeden önce ışık planı veya en azından üreticinin fotometrik tablosu istenebilir. Bu, hem fazla hem eksik aydınlatmanın önüne geçer.

Demo sitemizdeki lineer ürünlere [lineer kategorisinden](/tr/urunler?category=lineer) göz atabilir, sorularınız için [iletişim sayfasını](/tr/iletisim) kullanabilirsiniz.`,
      en: `Linear lighting is a luminaire system that gives light as one long, unbroken line instead of separate points. It usually consists of a slim aluminium profile with an LED strip inside. The light is spread along the whole length of the profile.

## Where it works

It suits long, regular spaces. Corridors, open-plan offices, shop aisles and kitchen islands are the common cases. At home it also works over a dining table or along a living room. Profiles are made to measure, so you can set the length, light colour and finish for the room.

For a single painting or shelf, a spot is the better tool. Where you need accents, a linear system and spots can work together.

## Three main types

**Suspended.** The profile hangs from the ceiling on wires. Light can go down, up, or both. It is a good fit for offices and restaurants with high ceilings, because the light source sits closer to the work surface.

**Surface-mounted.** The profile is fixed straight to the ceiling or wall. It takes little height and is easy to install. It helps in renovations where you do not want to cut the ceiling.

**Recessed.** The profile sits inside the ceiling or wall, so the surface stays flat. The plaster or false ceiling needs an opening in advance. For some products the opening must be a few millimetres larger than the profile. Check the maker's installation drawing before you cut.

## How to choose the size

Start with the length of the room and the ceiling height. You can pick one long profile or join modules end to end. At the joints the diffuser can look slightly different in brightness, so makers advise using modules from the same series for a continuous run.

Think about brightness in lumens. Catalogues often give lumen output per fitting, not per metre. To compare products, divide the total lumens by the length. Compare values given for the same colour temperature and the same wattage.

You can estimate the total light you need with two steps:

- Multiply the target illuminance (lux) by the floor area (m²).
- Divide the result by a factor that shows how much of the light reaches the work plane.

Example (hypothetical): an office of 20 m² is planned for 500 lux. 500 × 20 gives 10,000 lm. If the factor is 0.6, the fittings need to give about 16,700 lm. The real factor depends on ceiling and wall colour and on the luminaire. For a precise result, use the maker's photometric data.

## Glare and diffuser

Glare matters wherever people work at screens. Many low-glare linear products use a microprismatic diffuser and keep the UGR value below 19. Check the conditions under which the UGR was calculated. The same luminaire can give a different value in a different room.

## Short checklist

- Room length and ceiling height
- Suspended, surface or recessed mounting
- Total lumens and colour temperature (3000 K to 4000 K is common in offices)
- Glare limit and diffuser type
- Whether you need a dimmable driver
- How the joints will look

Before you decide, ask for a lighting layout or at least the maker's photometric table. It helps you avoid both too much and too little light.

You can browse the linear range in the demo shop through the [linear category](/en/products?category=lineer), and use the [contact page](/en/contact) for questions.`,
    },
  },
  {
    slug: 'gomme-spot-nasil-secilir',
    publishedAt: new Date('2026-08-04T00:00:00.000Z'),
    imageUrl: '/demo/product-gomme-spot.webp',
    title: {
      tr: 'Gömme spot nasıl seçilir? Ölçü, açı ve kamaşma',
      en: 'How to choose a recessed spot: size, angle and glare',
    },
    description: {
      tr: 'Gömme spot seçerken delik çapına, ışık açısına, kamaşmaya, tavan arası derinliğine ve aralığa bakın. Hepsini sırayla ve örneklerle anlattık.',
      en: 'Choosing a recessed spot comes down to cut-out size, beam angle, glare, ceiling depth and spacing. Here is each step with a short worked example.',
    },
    excerpt: {
      tr: 'Doğru gömme spot; delik çapı, huzme açısı, kamaşma, tavan derinliği ve aralıkla belirlenir. Satın almadan önce kontrol edeceğiniz noktaları sıraladık.',
      en: 'The right recessed spot depends on cut-out size, beam angle, glare control, ceiling depth and spacing. Here is what to check before you buy and before you cut.',
    },
    imageAlt: {
      tr: 'Beyaz çerçeveli, yuvarlak gömme LED spot (downlight) armatür, yandan görünüş',
      en: 'A white round recessed LED downlight with a wide trim, seen from the side',
    },
    body: {
      tr: `Gömme spot seçerken beş şeye bakın: delik çapı, huzme açısı, kamaşma, tavan arası derinliği ve spotlar arası mesafe. Bu beşi doğru ayarlanırsa ışık düzgün dağılır ve gözü yormaz. Önce tavanın ölçüsünü alın, sonra ışığı seçin.

## Delik çapı

Delik çapı, ürüne göre değişir ve tavana açılacak boşluğu belirler. Üreticiler farklı seriler için farklı çaplar verir. Örneğin bazı ürün aileleri 68, 100, 150 ve 200 mm delikle gelir. Evlerde genellikle küçük çaplar, ofis ve mağazalarda daha büyük olanlar kullanılır. Delmeden önce ürün sayfasındaki "montaj deliği" değerine bakın. Spotun görünen dış çerçevesi, delik çapından geniştir; ikisini karıştırmayın.

## Huzme açısı

Huzme açısı, ışık şiddetinin tepe değerinin yarısına düştüğü iki düzlem arasındaki açıdır. Dar açı (örneğin 24 derece) vurgu yapar. Geniş açı (örneğin 60 derece) daha geniş ve yumuşak bir alanı aydınlatır.

Yerde oluşan ışık dairesini şöyle hesaplarsınız: çap = 2 × mesafe × tan(açı ÷ 2). Örnek: tavan 2,7 m, çalışma düzlemi 0,85 m ise mesafe 1,85 m olur. 60 derecelik spot bu düzlemde yaklaşık 2,1 m çaplı bir daire verir.

## Kamaşma

Spotun göze gelen ışığı rahatsız edebilir. Kamaşmayı yalnızca huzme açısı belirlemez. UGR değeri, odanın boyutuna, armatürün konumuna ve gözlemcinin bakış noktasına göre hesaplanır. Pratikte şunlar işe yarar:

- Işık kaynağı armatürün içinde derinde dursun (derin reflektör, siperlik veya ızgara).
- Ekran başı işlerde ürünün UGR değerinin hangi koşulda hesaplandığına bakın. EN 12464-1, ofis çalışma masasında UGR 19'u sınır olarak verir.

## Tavan arası derinliği

Armatürün boyu ile tavanda ihtiyaç duyduğu boşluk aynı şey değildir. Sürücü (driver) ve bağlantı kutusu da yer ister. Üreticinin belirttiği montaj derinliğini, sürücünün yerini ve tavan arasındaki boruları, kanalları ve kirişleri kontrol edin. Yalıtım malzemesi varsa armatürün yalıtımla temasına uygun olup olmadığına bakın (IC derecesi). Bu bilgi ürün belgesinde bulunmalıdır.

## Aralık

Spotlar arası mesafe için kaynaklarda farklı pratik kurallar vardır. Kimi tavan yüksekliğini ikiye böler, kimi üçe. Bunlar yalnızca başlangıç noktasıdır, çünkü sonuç huzme açısına, lümen değerine ve duvar rengine göre değişir.

Basit bir yol şudur:

1. Çalışma düzlemindeki ışık dairesinin çapını hesaplayın.
2. Spotlar arasını bu çapa yakın tutun; daireler birbirine hafifçe değsin.
3. Üreticinin fotometrik tablosu veya bir ışık planı ile hedef lüks değerini doğrulayın.

Gömme spotlar alçak tavanda çok yakın dizilirse tavan benekli görünür. Bunu önlemek için az sayıda ama yeterli lümen veren spot ile başlayın, gerekirse sayıyı artırın. Oda kullanımı değişirse, örneğin masa yer değiştirirse, sabit yerleşim sorun yaratabilir. Böyle yerlerde gömme spotu bir ray sistemiyle birlikte düşünün.

## Sık yapılan hata

En sık hata, spotu yalnızca watt değerine göre seçmektir. Watt, tüketimi anlatır; ışık miktarını lümen anlatır. İki ürünü kıyaslarken lümen, huzme açısı ve renk sıcaklığına bakın. Tavanı bir kez deldikten sonra geri dönüş zordur, bu yüzden yerleşim planını kâğıt üzerinde veya bir ışık hesabıyla önceden deneyin.

## Seçim özeti

- Delik çapını ve montaj derinliğini ölçün.
- Huzme açısını amaca göre seçin: vurgu için dar, genel ışık için geniş.
- Kamaşma için derin ve korumalı modelleri tercih edin.
- Sürücü ve yalıtım koşullarını belgeden okuyun.
- Aralığı hesaplayın, sonra plan veya fotometrik veriyle doğrulayın.
- Dimmer kullanacaksanız sürücünün kısılabildiğinden emin olun.

Demo sitemizdeki [gömme spot ürünlerine](/tr/urunler?category=gomme-spot) bakabilir, sorularınız için [iletişim sayfasını](/tr/iletisim) kullanabilirsiniz.`,
      en: `When you choose a recessed spot, check five things: cut-out size, beam angle, glare, ceiling depth and spacing. If these are right, the light is even and easy on the eyes. Measure the ceiling first, then pick the light.

## Cut-out size

The cut-out is the hole in the ceiling, and it depends on the product. Makers offer different sizes for different series. For example, some product families come with 68, 100, 150 and 200 mm holes. Homes tend to use smaller sizes and offices and shops larger ones. Read the "cut-out" value on the product page before you drill. The visible trim of the spot is wider than the hole, so do not mix up the two.

## Beam angle

The beam angle is the angle between the two planes where light intensity falls to half of its peak. A narrow angle (for example 24 degrees) gives accent light. A wide angle (for example 60 degrees) lights a broader, softer area.

You can work out the light circle on a surface: diameter = 2 × distance × tan(angle ÷ 2). Example: with a 2.7 m ceiling and a work surface at 0.85 m, the distance is 1.85 m. A 60 degree spot makes a circle about 2.1 m wide at that height.

## Glare

Light that reaches the eye directly is uncomfortable. The beam angle alone does not set glare. UGR is calculated from the room size, the position of the luminaire and the viewpoint of the observer. In practice, these help:

- Set the light source deep inside the luminaire (deep reflector, baffle or louvre).
- For screen work, check the conditions under which the maker calculated the UGR. EN 12464-1 sets UGR 19 as the limit for office desks.

## Ceiling depth

The height of the luminaire and the space it needs in the ceiling are not the same thing. The driver and the junction box need room too. Check the installation depth from the maker, the position of the driver, and any pipes, ducts or beams above the ceiling. If there is insulation, check whether the luminaire may touch it (the IC rating). This should be in the product documents.

## Spacing

Sources give different rules of thumb for the distance between spots. Some divide the ceiling height by two, others by three. They are only starting points, because the result also depends on beam angle, lumen output and wall colour.

A simple way to start:

1. Calculate the diameter of the light circle on the work surface.
2. Keep the distance between spots close to that diameter, so the circles just touch.
3. Check the target lux with the maker's photometric table or a lighting layout.

## Summary

- Measure the cut-out size and the installation depth.
- Choose the beam angle for the job: narrow for accents, wide for general light.
- Prefer deep, shielded models to limit glare.
- Read the driver and insulation conditions in the documents.
- Calculate the spacing, then confirm it with a layout or photometric data.
- If you plan to dim, make sure the driver is dimmable.

You can look at the [recessed spot range](/en/products?category=gomme-spot) in the demo shop, and use the [contact page](/en/contact) for questions.`,
    },
  },
  {
    slug: 'ofis-aydinlatmasi-kac-lux',
    publishedAt: new Date('2026-09-01T00:00:00.000Z'),
    imageUrl: '/demo/product-slim-panel.webp',
    title: {
      tr: 'Ofis aydınlatması kaç lüks olmalı? EN 12464-1 değerleri',
      en: 'How many lux for an office? EN 12464-1 values',
    },
    description: {
      tr: "Yazı yazma, okuma ve bilgisayar işi için ofiste 500 lüks gerekir. EN 12464-1'in ofis değerlerini, renk sıcaklığı seçimini ve standardın kapsamını özetledik.",
      en: 'For writing, reading and screen work, EN 12464-1 asks for 500 lux in the office task area. See the office values, colour temperature practice and what the standard covers.',
    },
    excerpt: {
      tr: 'Standart, ofiste yazı ve bilgisayar işi için 500 lüks bakımlı aydınlık düzeyi ister. Teknik çizim, toplantı ve arşiv değerlerini ve standardın sınırlarını anlattık.',
      en: 'The standard asks for 500 lux maintained illuminance for desk and screen work. Here are the values for drawing, meetings and archives, plus the limits of the standard.',
    },
    imageAlt: {
      tr: 'Beyaz, yuvarlak, ince bir LED panel armatürün önden görünüşü',
      en: 'Front view of a slim round white LED panel luminaire',
    },
    body: {
      tr: `Yazı yazma, okuma ve bilgisayar işi yapılan bir ofiste EN 12464-1, çalışma alanı için 500 lüks bakımlı aydınlık düzeyi ister. Teknik çizim gibi ince işlerde bu değer 750 lükse çıkar. Ofis tablosu renk sıcaklığı vermez; uygulamada çoğunlukla 3000 K ile 4000 K arası seçilir.

## Standart nedir?

EN 12464-1, kapalı mekanlardaki çalışma alanlarının aydınlatmasını düzenleyen Avrupa standardıdır. Güncel baskısı 2021 tarihlidir. Her iş türü için asgari bakımlı aydınlık düzeyini, düzgünlük oranını, renk geriverim indeksini (Ra) ve kamaşma sınırını (UGR) tablolar halinde verir.

"Bakımlı" sözcüğü önemlidir. Değer, armatürler kirlendikten ve yaşlandıktan sonra bile korunması gereken seviyedir. Yeni kurulumda ölçülen değer bu yüzden daha yüksek olmalıdır.

## Ofis değerleri

Aşağıdaki değerler standardın ofis tablosunu yayımlayan üretici kaynaklarıyla karşılaştırılarak derlendi. Tüm satırlarda Ra en az 80'dir.

- **Dosyalama, fotokopi:** 300 lüks, UGR 19
- **Yazı yazma, okuma, bilgisayarla veri işleme:** 500 lüks, UGR 19
- **Teknik çizim:** 750 lüks, UGR 16
- **CAD çalışma istasyonu:** 500 lüks, UGR 19
- **Toplantı ve konferans odası:** 500 lüks, UGR 19
- **Resepsiyon:** 300 lüks, UGR 22
- **Arşiv:** 200 lüks, UGR 25

Düzgünlük oranı (U0) yazı ve bilgisayar işinde 0,60, teknik çizimde 0,70'tir. Yani çalışma alanında en karanlık nokta, ortalamanın en az yüzde 60'ı kadar aydınlık olmalıdır.

## Çalışma alanı ve çevresi

500 lüks, odanın her yerine değil görev alanına uygulanır. Hemen çevresi için daha düşük değerler yeterlidir. Standart, 500 lüks görev için çevre alanda 300 lüks, arka planda 100 lüks gösterir. Bu fark odada ışığın dengeli görünmesini sağlar.

## Renk sıcaklığı

Ofis tablosunda Kelvin değeri yoktur, yalnızca renk geriverimi (Ra 80) vardır. Renk sıcaklığını tasarımcı ve kullanıcı seçer.

Yaygın uygulama şöyledir:

- **3000 K:** Sıcak beyaz. Konforlu ve sakin bir atmosfer verir.
- **4000 K:** Nötr beyaz. Odaklanma gerektiren işlerde ve ortak ofislerde sık seçilir.

Bir odada tek bir renk sıcaklığı kullanmak, armatürler arasındaki renk farkını önler.

## Standart neyi kapsar, neyi kapsamaz?

Kapsar: Kapalı mekan iş yerlerinde aydınlığın miktarını ve kalitesini, yani aydınlık düzeyi, düzgünlük, kamaşma, renk geriverimi ve benzer ölçütleri.

Kapsamaz:

- Dış mekan çalışma alanlarını. Onlar standardın ayrı bölümü EN 12464-2'dedir.
- Yasal bir güvenlik veya sağlık zorunluluğunu. Standart bir tasarım gereksinimleri belgesidir, kendi başına yasa değildir. Bağlayıcılığı sözleşme ve yerel mevzuata bağlıdır.
- Bir ürünün kaç lümen vermesi gerektiğini. Lüks hedefinden lümen hesabı ayrıca yapılır.

2021 baskısı, gerekçeli durumlarda değerlerin artırılıp azaltılmasına izin veren düzeltme etkenleri getirmiştir. Örneğin görev kritikse veya gün ışığı yetersizse değer yukarı çekilebilir.

## Bir örnek senaryo

Bir toplantı odasında hem sunum hem not alma yapılıyor olsun. Tablo toplantı odası için 500 lüks der. Aynı odanın bir köşesi dosyalama için kullanılıyorsa o köşe için 300 lüks yeterlidir. Her alan için ayrı değer almak, gereksiz yere ışık harcamaktan sizi korur. Bu yaklaşım hem konforu hem elektrik faturasını dengeler.

Tabloyu değiştirmeniz gerekirse, örneğin işin kritik olması nedeniyle değeri artırırsanız, gerekçenizi proje dosyasında yazılı tutun. Böylece kararın nedeni sonradan da anlaşılır.

## Pratik sonuç

Plana başlamadan önce mekanda hangi işlerin yapıldığını yazın. Her iş için tablodaki değeri alın, sonra lümen ve armatür sayısını hesaplayın. Ölçüm yapacaksanız çalışma düzlemi yüksekliğinde, lüksmetre ile yapın.

Demo sitemizdeki [panel ürünlerine](/tr/urunler?category=panel) bakabilir, plan sorularınız için [iletişim sayfasını](/tr/iletisim) kullanabilirsiniz.`,
      en: `For an office where people write, read and work at screens, EN 12464-1 asks for 500 lux maintained illuminance on the task area. Fine work such as technical drawing goes up to 750 lux. The office table gives no colour temperature; in practice, 3000 K to 4000 K is the usual choice.

## What the standard is

EN 12464-1 is the European standard for lighting indoor workplaces. The current edition dates from 2021. For each type of task it lists a minimum maintained illuminance, a uniformity ratio, a colour rendering index (Ra) and a glare limit (UGR).

"Maintained" matters. The value must still hold after the luminaires have aged and collected dirt. A new installation should therefore measure higher than the table value.

## Office values

The values below come from the standard's office table as published by lighting manufacturers, and the sources agree. Ra is at least 80 in every row.

- **Filing, copying:** 300 lux, UGR 19
- **Writing, typing, reading, data processing:** 500 lux, UGR 19
- **Technical drawing:** 750 lux, UGR 16
- **CAD workstations:** 500 lux, UGR 19
- **Conference and meeting rooms:** 500 lux, UGR 19
- **Reception desk:** 300 lux, UGR 22
- **Archives:** 200 lux, UGR 25

Uniformity (U0) is 0.60 for desk and screen work and 0.70 for technical drawing. In practice, the darkest point of the task area should reach at least 60 percent of the average.

## Task area and surroundings

The 500 lux applies to the task area, not to every corner of the room. The area around it can be lower. For a 500 lux task, the standard lists 300 lux in the immediate surroundings and 100 lux in the background. This step-down keeps the room looking balanced.

## Colour temperature

The office table lists colour rendering (Ra 80) but no kelvin value. Designers and users choose the colour temperature.

Common practice looks like this:

- **3000 K:** warm white, a calm and comfortable look.
- **4000 K:** neutral white, often chosen for focused work and shared offices.

Using one colour temperature in a room avoids visible colour differences between luminaires.

## What the standard covers and what it does not

It covers the quantity and quality of light in indoor workplaces: illuminance, uniformity, glare, colour rendering and similar criteria.

It does not cover:

- Outdoor workplaces. These are in a separate part, EN 12464-2.
- Legal safety or health duties. The standard is a set of design requirements, not a mandatory rule on its own. How binding it is depends on contracts and local regulation.
- How many lumens a product must give. You calculate lumens from the lux target separately.

The 2021 edition allows values to be raised or lowered in justified cases. For example, a critical task or a lack of daylight can raise the requirement.

## In practice

Before you plan, list the tasks done in each room. Take the table value for each task, then calculate lumens and the number of luminaires. If you measure, do it at work plane height with a lux meter.

You can see the [panel range](/en/products?category=panel) in the demo shop, and use the [contact page](/en/contact) for planning questions.`,
    },
  },
  {
    slug: 'dis-mekan-aydinlatma-ip-sinifi',
    publishedAt: new Date('2026-09-29T00:00:00.000Z'),
    imageUrl: '/demo/product-bahce.webp',
    title: { tr: 'Dış mekan aydınlatmada IP sınıfı ne demek?', en: 'Outdoor lighting and IP ratings explained' },
    description: {
      tr: 'IP sınıfı, armatürün toza ve suya karşı korumasını iki rakamla gösterir. Bahçe, cephe ve bolard için hangi IP değerinin uygun olduğunu anlattık.',
      en: 'An IP rating shows how well a luminaire resists dust and water, in two digits. Learn what each digit means and which rating suits garden, facade and bollard lights.',
    },
    excerpt: {
      tr: 'IP kodundaki ilk rakam toz ve katı cisimleri, ikinci rakam suyu gösterir. Bahçe, cephe ve bolard armatürlerinde hangi sınıfa bakmanız gerektiğini özetledik.',
      en: 'The first IP digit covers dust and solid objects, the second covers water. Here is how to read the code and what to look for in garden, facade and bollard luminaires.',
    },
    imageAlt: {
      tr: 'Geceleyin çakıl bir yürüyüş yolunun kenarında sıralanmış, aşağı doğru ışık veren bolard armatürler',
      en: 'Bollard luminaires lining a gravel path at night, each casting light downward',
    },
    body: {
      tr: `IP sınıfı, bir armatürün toza ve suya karşı ne kadar korunduğunu iki rakamla gösterir. İlk rakam katı cisim ve toz korumasını, ikinci rakam su korumasını belirtir. Dış mekanda çoğu zaman en az IP65 aranır, toprağa gömülü veya su birikebilen yerlerde IP67 gerekir.

## IP kodu nasıl okunur?

Kod, IEC 60529 standardında tanımlıdır. "IP65" yazan bir armatürde 6 toz, 5 su korumasıdır. Rakamlar yükseldikçe koruma artar.

**İlk rakam (katı cisim ve toz):**

- 0: koruma yok
- 1: 50 mm ve daha büyük cisimler (elin tersi gibi)
- 2: 12,5 mm ve daha büyük cisimler (parmak)
- 3: 2,5 mm ve daha büyük cisimler (alet, kalın tel)
- 4: 1 mm ve daha büyük cisimler (tel, vida)
- 5: toza karşı korumalı; az miktarda toz girebilir ama zarar vermez
- 6: toz geçirmez

**İkinci rakam (su):**

- 0: koruma yok
- 1: dikey damlama
- 2: 15 derece eğikken damlama
- 3: dikeyden 60 dereceye kadar yağmur gibi serpinti
- 4: her yönden sıçrama
- 5: 6,3 mm memeden su jeti
- 6: 12,5 mm memeden güçlü su jeti
- 7: 1 m derinliğe kadar, 30 dakika geçici daldırma
- 8: 1 m'den derin, sürekli daldırma; koşulları üretici belirler
- 9K: yüksek basınçlı ve sıcak su ile temizlik

İki önemli ayrıntı vardır. IP67 veya IP68, jet testini geçtiği anlamına gelmez. Hem jet hem daldırma gerekiyorsa IP66/IP68 gibi çift işaret aranır. Ayrıca IP68'de derinlik ve süreyi üretici tanımlar, bu yüzden belgeye bakmak gerekir. Daldırma sınıfları, armatürün sudan çıkarıldıktan sonra çalışmasını garanti eder; su altında sürekli çalışması için ayrıca bilgi isteyin.

## Hangi uygulamada hangi sınıf?

Bu öneriler, rakamların anlamından çıkan pratik yaklaşımlardır. Her ürün için üreticinin belgesi esastır.

- **Bahçe ve peyzaj:** Yağmura ve sulama suyuna açık armatürlerde IP65 makul bir başlangıçtır. Toprağa gömülü veya çim içinde kalan armatürlerde su birikebilir; IP67 daha güvenlidir.
- **Cephe:** Duvara bakan armatür yağmur ve rüzgarla gelen suya, bazen yıkama suyuna maruz kalır. IP65 genellikle yeterlidir, temizlikte basınçlı su kullanılıyorsa IP66 düşünün.
- **Bolard ve yürüyüş yolu:** Yer seviyesine yakındır; su sıçraması, sulama ve yağmur birikintisi görür. IP65 çoğu zaman uygundur. Su basabilecek yerde IP67 seçin.
- **Teras ve sundurma:** Doğrudan yağmur almıyorsa IP44 (her yönden sıçrama) yeterli olabilir. Açık havaya çıkan yerde IP65'e geçin.

IP sınıfı darbe dayanımı anlamına gelmez. Araç ya da yayaların çarpabileceği yerlerde ayrı bir ölçüt olan IK sınıfına da bakın.

## Mevsim ve konum etkisi

Aynı bahçede iki armatürün koşulu farklı olabilir. Çatı altındaki cephe armatürü yağmuru az görür, açıkta duran bolard ise her yağışı alır. Armatürü konuma göre seçin, tüm projede aynı sınıfı varsaymayın. Yağmur dışında sulama sistemi, kar ve yıkama gibi etkenleri de listeye ekleyin.

## Satın alırken ne kontrol edilir?

- Ürün etiketinde veya katalogda IP değerinin yazılı olması
- Kablo girişinin (rakor) ve bağlantının aynı IP sınıfında olması
- Sürücünün armatürün içinde mi dışında mı olduğu ve onun IP sınıfı
- Kurulumda contanın doğru yerleştirilmesi ve sıkılması

Armatür IP65 olsa da hatalı bağlantı, sınıfı geçersiz kılar. Kurulumu bir elektrikçiye yaptırın ve su alabilecek ek yerlerini yalıtılmış bağlantı kutusuyla koruyun.

Demo sitemizdeki [dış mekan ürünlerine](/tr/urunler?category=dis-mekan) bakabilir, sorularınız için [iletişim sayfasını](/tr/iletisim) kullanabilirsiniz.`,
      en: `An IP rating shows, in two digits, how well a luminaire resists dust and water. The first digit covers solid objects and dust, the second covers water. For outdoor use, IP65 is a common minimum, and IP67 suits fixtures set in the ground or in places where water can collect.

## How to read the code

The code is defined in IEC 60529. In "IP65", the 6 is dust protection and the 5 is water protection. A higher digit means more protection.

**First digit (solids and dust):**

- 0: no protection
- 1: objects of 50 mm and larger (such as the back of a hand)
- 2: objects of 12.5 mm and larger (a finger)
- 3: objects of 2.5 mm and larger (tools, thick wire)
- 4: objects of 1 mm and larger (wire, screws)
- 5: dust protected; some dust may enter, but not enough to cause harm
- 6: dust tight

**Second digit (water):**

- 0: no protection
- 1: vertical dripping
- 2: dripping with the enclosure tilted 15 degrees
- 3: spray up to 60 degrees from vertical, like rain
- 4: splashing from any direction
- 5: water jets from a 6.3 mm nozzle
- 6: powerful jets from a 12.5 mm nozzle
- 7: temporary immersion, up to 1 m for 30 minutes
- 8: continuous immersion, deeper than 1 m, under conditions the maker sets
- 9K: high-pressure, high-temperature wash-down

Two details matter. IP67 or IP68 does not mean the product passed the jet tests. If you need both, look for a double rating such as IP66/IP68. Also, with IP68 the maker defines depth and time, so read the documents. Immersion ratings mean the unit works after it comes out of the water; ask separately if it must run under water.

## Which rating for which use?

These are practical readings of the digits, not rules. The maker's documents decide for each product.

- **Garden and landscape:** IP65 is a reasonable start for fixtures exposed to rain and sprinklers. For fixtures in the ground or in lawns, water can pool, so IP67 is safer.
- **Facade:** a wall-mounted luminaire meets rain, wind-driven water and sometimes washing. IP65 is often enough. If the wall is cleaned with pressure water, consider IP66.
- **Bollards and paths:** they sit low and meet splashes, sprinklers and puddles. IP65 is often suitable. Where flooding is possible, choose IP67.
- **Terraces and porches:** if the fixture is sheltered from direct rain, IP44 (splashing from any direction) can be enough. In the open, move up to IP65.

An IP rating does not describe impact strength. Where cars or people may hit a fixture, also look at the separate IK rating.

## What to check when buying

- The IP value is written on the product label or in the catalogue.
- The cable entry (gland) and the connection have the same IP class.
- Whether the driver is inside or outside the luminaire, and its own IP class.
- That the seal is fitted and tightened correctly during installation.

A luminaire rated IP65 loses that protection if the connection is wrong. Have an electrician install it, and protect any joint that could meet water with a sealed junction box.

You can see the [outdoor range](/en/products?category=dis-mekan) in the demo shop, and use the [contact page](/en/contact) for questions.`,
    },
  },
  {
    slug: 'led-donusumu-enerji-tasarrufu',
    publishedAt: new Date('2026-10-20T00:00:00.000Z'),
    imageUrl: '/demo/area-endustriyel.webp',
    title: {
      tr: 'LED dönüşümü ile ne kadar tasarruf edilir? Hesap örneği',
      en: 'How much does an LED upgrade save? A worked example',
    },
    description: {
      tr: 'LED dönüşümünde tasarruf, watt farkı, yanma süresi ve kWh fiyatıyla hesaplanır. Varsayımsal bir örnek, kontrol listesi ve işe yaramadığı durumlar.',
      en: 'Estimate LED savings from the watt difference, hours of use and the price per kWh. See a worked example with hypothetical numbers, checks and when it does not pay.',
    },
    excerpt: {
      tr: 'Tasarrufu üç sayıyla tahmin edebilirsiniz: watt farkı, yıllık yanma süresi ve kWh fiyatı. Örnek hesabı, dikkat edilecekleri ve dönüşümün işe yaramadığı durumu anlattık.',
      en: 'You can estimate savings with three numbers: the watt difference, yearly hours of use and the price per kWh. Here is a worked example, what else to check, and when LED does not pay.',
    },
    imageAlt: {
      tr: 'Büyük bir üretim salonunun tavanında sıralanmış LED sanayi tipi armatürler',
      en: 'LED high-bay luminaires in rows on the roof of a large production hall',
    },
    body: {
      tr: `LED dönüşümünde yıllık tasarrufu üç sayıyla tahmin edersiniz: eski ve yeni armatür arasındaki watt farkı, yıllık yanma süresi ve kWh fiyatı. Aşağıdaki formül bunu birkaç dakikada verir. Çok az yanan bir lambada ise dönüşüm kendini yıllarca çıkarmayabilir.

## Formül

1. **Yıllık kWh tasarrufu** = (eski watt − yeni watt) × adet × yıllık yanma saati ÷ 1000
2. **Yıllık tasarruf (TL)** = kWh tasarrufu × kWh fiyatı
3. **Geri ödeme süresi (yıl)** = toplam dönüşüm maliyeti ÷ yıllık tasarruf

Floresan armatürde balastı da hesaba katın: eski watt değeri, lambanın değil tüm armatürün çektiği güç olmalıdır.

## Hesap örneği (varsayımsal sayılar)

Aşağıdaki sayıların hepsi örnek içindir. Gerçek fiyat, güç ve süreleri kendi tesisatınızdan alın.

- Eski: 20 adet 50 W halojen spot
- Yeni: 20 adet 6 W LED spot
- Yanma süresi: günde 6 saat, yılda 365 gün = 2.190 saat
- Elektrik fiyatı: kWh başına 4 TL (örnek)
- LED spot fiyatı: adet başına 150 TL (örnek)

Hesap:

- Fark: 50 − 6 = 44 W
- kWh tasarrufu: 44 × 20 × 2.190 ÷ 1000 = yaklaşık 1.927 kWh
- Yıllık tasarruf: 1.927 × 4 = yaklaşık 7.709 TL
- Dönüşüm maliyeti: 20 × 150 = 3.000 TL
- Geri ödeme: 3.000 ÷ 7.709 = yaklaşık 0,39 yıl, yani 5 ay civarı

Bu örnek, kullanımı yoğun bir mekanı gösterir. Montaj işçiliğini, yeni sürücüyü veya kısıcıyı eklerseniz maliyet artar.

Bu hesabın zayıf noktası, yanma süresidir. Süreyi tahmin etmek yerine bir hafta boyunca gerçekten ne kadar yandığını not etmek daha doğru sonuç verir. Elektrik fiyatı da zamanla değişir, bu yüzden hesabı yılda bir güncelleyin.

## Daha az yanan yerde durum değişir

Aynı 50 W halojen lambanın bir depoda günde yarım saat yandığını düşünün. Yılda 182,5 saat çalışır. Tek lamba için tasarruf 44 W × 182,5 saat ÷ 1000 = yaklaşık 8 kWh'dir. Örnekteki 4 TL ile bu, yılda yaklaşık 32 TL eder. 150 TL'lik bir LED lamba kendini yaklaşık 4,7 yılda çıkarır. Sayılar örnektir.

Dönüşümü tek seferde yapmak zorunda değilsiniz. Önce en çok yanan alanlardan başlayıp ilk ayın faturasını eski faturayla karşılaştırarak hesabınızı sınayabilirsiniz. Fark beklediğinizden küçükse yanma süresini ve watt değerlerini yeniden kontrol edin.

## Dönüşümde başka ne kontrol edilir?

- **Işık miktarı ve dağılımı:** Watt düşer ama ışık da düşmemeli. Mekanın lüks hedefini yeni armatürün lümen ve huzme değerleriyle karşılaştırın.
- **Renk:** Renk sıcaklığını ve renk geriverimini (Ra) eski ışıkla kıyaslayın.
- **Kısma:** Kısıcı varsa LED sürücü ve kısıcı birbiriyle uyumlu olmalı; aksi halde titreme veya sınırlı kısma olur.
- **Balast ve starter:** Floresanda balastı çıkarmak ve devreyi yeniden bağlamak gerekebilir. Bu iş elektrikçi ister.
- **Bakım tasarrufu:** Lamba değişim işçiliği ve yedek stok azalır. Bu kalemi yalnızca kendi kayıtlarınıza dayanarak hesaplayın.
- **Fatura yapısı:** Ticari tarifede güç (kW) bedeli varsa tasarruf kWh'den fazla olabilir.
- **Teşvik:** Bölgenize veya kuruma ait destek varsa geri ödemeyi kısaltır; geçerli programı kontrol edin.

## Ne zaman karşılığını vermez?

- Yılda çok az yanan lambalar (depo, arşiv, nadir kullanılan oda)
- Zaten verimli ve yakın zamanda yenilenmiş sistemler
- Yeterli ışığı vermediği için sonradan yeniden değiştirilmesi gereken ürünler; ucuz ama yetersiz bir LED tasarrufu boşa çıkarır

Önce en çok yanan ve en çok watt çeken armatürlerden başlamak, tasarrufun büyük kısmını erken yakalamanın yoludur.

Demo sitemizdeki [panel ürünlerine](/tr/urunler?category=panel) göz atabilir, planınız için [iletişim sayfasını](/tr/iletisim) kullanabilirsiniz.`,
      en: `You can estimate the yearly saving of an LED upgrade with three numbers: the watt difference between the old and new luminaire, the hours of use per year, and the price per kWh. The formula below takes a few minutes. For a lamp that burns very little, though, an upgrade may take years to pay back.

## The formula

1. **Yearly energy saved (kWh)** = (old watts − new watts) × number of units × hours per year ÷ 1000
2. **Yearly saving (money)** = kWh saved × price per kWh
3. **Payback (years)** = total upgrade cost ÷ yearly saving

For fluorescent fittings, count the ballast. The old figure should be what the whole fitting draws, not only the lamp.

## Worked example (hypothetical numbers)

Every number below is an example. Use real prices, power and hours from your own site.

- Old: 20 halogen spots of 50 W
- New: 20 LED spots of 6 W
- Use: 6 hours a day, 365 days = 2,190 hours a year
- Electricity price: 4 TL per kWh (example)
- LED spot price: 150 TL each (example)

The calculation:

- Difference: 50 − 6 = 44 W
- Energy saved: 44 × 20 × 2,190 ÷ 1000 = about 1,927 kWh
- Yearly saving: 1,927 × 4 = about 7,709 TL
- Upgrade cost: 20 × 150 = 3,000 TL
- Payback: 3,000 ÷ 7,709 = about 0.39 years, or roughly 5 months

This is a heavily used space. If you add installation labour, a new driver or a dimmer, the cost goes up.

## When use is low, the result changes

Now take one 50 W halogen lamp in a storeroom that burns half an hour a day. It runs 182.5 hours a year. The saving for one lamp is 44 W × 182.5 hours ÷ 1000 = about 8 kWh. At the example price of 4 TL, that is about 32 TL a year. A 150 TL LED lamp then needs about 4.7 years to pay for itself. These numbers are examples.

## What else to check

- **Light level and distribution:** the watts drop, but the light should not. Compare the lux target of the room with the lumens and beam of the new luminaire.
- **Colour:** compare colour temperature and colour rendering (Ra) with the old light.
- **Dimming:** if there is a dimmer, the LED driver and the dimmer must be compatible. If not, you get flicker or a limited range.
- **Ballast and starter:** with fluorescent lamps you may need to remove the ballast and rewire the circuit. That job calls for an electrician.
- **Maintenance savings:** fewer lamp changes mean less labour and less spare stock. Count this only from your own records.
- **Tariff structure:** if a commercial tariff has a demand charge (kW), the saving can be larger than the kWh alone.
- **Incentives:** a local or institutional programme can shorten payback. Check which ones apply.

## When it does not pay

- Lamps that burn very few hours a year (storerooms, archives, rarely used rooms)
- Systems that are already efficient or were renewed recently
- Cheap products that do not give enough light and must be replaced again; a poor LED can cancel the saving

Starting with the luminaires that burn longest and draw the most watts captures most of the saving early.

You can look at the [panel range](/en/products?category=panel) in the demo shop, and use the [contact page](/en/contact) for your plan.`,
    },
  },
];
