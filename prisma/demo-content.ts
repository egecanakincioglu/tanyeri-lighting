// The fictional content of the public demo: Turkish and English, with pictures from public/demo. Every record goes
// through the zod schemas of the content services. Prisma is used directly because the write services refuse to run in
// demo mode. Everything here is made up: names, address, phone number and links.
import { statSync } from 'node:fs';
import type { PrismaClient } from '../src/generated/prisma/client.ts';
import { toColumns } from '../src/server/content/bilingual.ts';
import { demoBlogPosts } from './demo-blog.ts';
import {
  aboutPageSchema,
  applicationAreaSchema,
  blogPostSchema,
  catalogSchema,
  categorySchema,
  featuredProductIdsSchema,
  homeBannerSchema,
  legalPageSchema,
  pageMetadataSchema,
  productSchema,
  projectSchema,
  promoBoardSchema,
  referenceSchema,
  serviceSchema,
  siteSettingsSchema,
  socialLinkSchema,
  type PageKey,
} from '../src/server/content/schemas.ts';

const pair = (tr: string, en: string) => ({ tr, en });
const img = (file: string) => `/demo/${file}`;

// What each demo picture shows, written from the picture itself. A picture used on more than one page has one
// description. The wording differs from the card titles on purpose, so a screen reader does not read the same words twice.
const hall = pair(
  'Mavi çelik çatı kafesi ve tavandan sarkan armatürleriyle boş bir üretim salonu.',
  'An empty hall with a blue steel roof frame and luminaires hanging from the ceiling.',
);
const imageDescriptions: Record<string, ReturnType<typeof pair>> = {
  'area-konut.webp': pair(
    'Akşam ışığında, tavana ve rafın arkasına gizlenmiş şeritlerle aydınlatılmış bir oturma odası.',
    'A living room in the evening, lit by strips hidden in the ceiling and behind a shelf.',
  ),
  'area-ofis.webp': pair(
    'Geniş bir atriyumun tavanında altıgen biçimli, beyaz ışık veren büyük armatürler.',
    'Large hexagon-shaped luminaires giving white light on the ceiling of a wide atrium.',
  ),
  'area-endustriyel.webp': hall,
  'service-uygulama.webp': hall,
  'area-otel.webp': pair(
    'Ahşap çıtalı kavisli bir duvarın önünde karşılama bankosu olan geniş ve aydınlık bir lobi.',
    'A wide, bright lobby with a reception desk in front of a curved wall of wooden slats.',
  ),
  'area-peyzaj.webp': pair(
    'Geceleyin taş bir bahçe yolunu ve ağaçları aydınlatan alçak lambalar.',
    'Low lamps lighting a stone garden path and the trees around it at night.',
  ),
  'area-cephe.webp': pair(
    'Çam ağaçlarının arasında, pencereleri ve duvar lambalarıyla geceleyin ışıldayan beyaz bir ev.',
    'A white house among pine trees at night, glowing from its windows and wall lamps.',
  ),
  'service-tasarim.webp': pair(
    'Siyah ve altın tonlarında, ışık şeritleriyle aydınlatılmış bir yatak odası ve giyinme odası.',
    'A bedroom and walk-in wardrobe in black and gold, lit by light strips.',
  ),
  'service-yenileme.webp': pair(
    'Sarı kapılı ve ahşap garaj kapılı, duvar lambalarıyla aydınlatılmış beyaz bir ev; gökyüzü gece mavisi.',
    'A white house with a yellow door and wooden garage doors, lit by wall lamps under a night-blue sky.',
  ),
  'banner.webp': pair(
    'Koyu mavi gece gökyüzünün altında, duvar lambalarıyla aydınlatılmış büyük bir ev ve garaj.',
    'A large house and garage lit by wall lamps under a deep blue night sky.',
  ),
  'promo-dekoratif.webp': pair(
    'Karanlıkta asılı duran, sıcak ışık veren çok sayıda ampul.',
    'Many bulbs hanging in the dark, giving off warm light.',
  ),
  'promo-yasam.webp': pair(
    'Mavi ve pembe ışıkla aydınlanmış, televizyonlu ve rafları kitap dolu bir oturma odası.',
    'A living room with a television and full bookshelves, lit in blue and pink.',
  ),
  'promo-dis-mekan.webp': pair(
    'Geceleyin bahçe yolu, çim ve terası küçük lambalarla aydınlatılmış modern bir ev.',
    'A modern house at night, with its garden path, lawn and terrace lit by small lamps.',
  ),
  'catalog-2026-cover.webp': pair(
    'Üstte şirket logosu, altta geceleyin aydınlatılmış bir evin fotoğrafı olan kapak.',
    'A cover with the company logo above a photo of a lit house at night.',
  ),
  'catalog-dekoratif-cover.webp': pair(
    'Üstte şirket logosu, altta parlayan sarkıt ampullerin fotoğrafı olan kapak.',
    'A cover with the company logo above a photo of glowing hanging bulbs.',
  ),
  'catalog-dis-mekan-cover.webp': pair(
    'Üstte şirket logosu, altta geceleyin aydınlatılmış bir bahçe ve terasın fotoğrafı olan kapak.',
    'A cover with the company logo above a photo of a lit garden and terrace at night.',
  ),
};
function describeImage(file: string) {
  const description = imageDescriptions[file];
  if (!description) throw new Error(`No description for ${file}`);
  return description;
}

const pdfSize = (file: string) => statSync(new URL(`../public/demo/${file}`, import.meta.url)).size;

const settings = siteSettingsSchema.parse({
  siteName: pair('Tanyeri Lighting', 'Tanyeri Lighting'),
  logoUrl: null,
  phone: '+90 212 000 00 00',
  email: 'info@tanyeri.example',
  address: pair(
    'Örnek Organize Sanayi Bölgesi, 1. Cadde No: 0, Esenyurt, İstanbul (demo adresi)',
    'Example Industrial Zone, 1st Street No: 0, Esenyurt, Istanbul (demo address)',
  ),
  workingHours: pair('Pazartesi - Cuma 09.00 - 18.00', 'Monday - Friday 09:00 - 18:00'),
  serviceArea: pair('Türkiye geneli ve yurt dışı projeler', 'Across Turkey and international projects'),
  languages: pair('Türkçe, İngilizce', 'Turkish, English'),
});

const socialLinks = [
  { platform: 'instagram', label: pair('Instagram', 'Instagram'), url: 'https://www.instagram.com/tanyerilighting' },
  { platform: 'facebook', label: pair('Facebook', 'Facebook'), url: 'https://www.facebook.com/tanyerilighting' },
  {
    platform: 'linkedin',
    label: pair('LinkedIn', 'LinkedIn'),
    url: 'https://www.linkedin.com/company/tanyerilighting',
  },
  { platform: 'youtube', label: pair('YouTube', 'YouTube'), url: 'https://www.youtube.com/@tanyerilighting' },
].map((link) => socialLinkSchema.parse(link));

// The site adds " | Tanyeri Lighting" to every title but the home one, which is shown as saved.
const pageMetadata: Record<PageKey, ReturnType<typeof pair>[]> = {
  home: [
    pair('LED ve Mimari Aydınlatma Çözümleri | Tanyeri Lighting', 'LED and Architectural Lighting | Tanyeri Lighting'),
    pair(
      'Konuttan endüstriyel tesise gömme spot, sarkıt, lineer, ray spot ve dış mekan armatürleri; aydınlatma projesi ve uygulama. Kurgusal demo marka.',
      'Recessed spots, pendants, linear, track and outdoor luminaires, with lighting design and installation from homes to industrial sites. Fictional demo brand.',
    ),
  ],
  products: [
    pair('Aydınlatma Armatürleri ve LED Ürünler', 'Lighting Fixtures and LED Luminaires'),
    pair(
      'Gömme spot, sarkıt, LED panel, lineer, ray spot ve dış mekan armatürleri. Güç, ölçü, renk ve malzeme bilgileriyle 30 model inceleyin. Demo ürünler.',
      'Browse 30 recessed, pendant, LED panel, linear, track and outdoor lighting fixtures, each with power, size, colour and material details. Demo products.',
    ),
  ],
  catalogs: [
    pair('Aydınlatma Kataloğu PDF İndir', 'Lighting Catalogs (PDF Download)'),
    pair(
      'Genel, dekoratif ve dış mekan aydınlatma kataloglarını PDF olarak indirin veya sitede sayfa sayfa görüntüleyin. Örnek kataloglar, kurgusal marka.',
      'Download the general, decorative and outdoor lighting catalogs as PDF files or read them page by page on the site. Sample catalogs, fictional brand.',
    ),
  ],
  services: [
    pair('Aydınlatma Projesi, Tasarım ve Uygulama', 'Lighting Design and Installation'),
    pair(
      'Aydınlatma projesi, aydınlık düzeyi hesabı, anahtar teslim uygulama, LED dönüşüm ve bakım hizmetlerinin kapsamı. Kurgusal demo marka, örnek hizmetler.',
      'Lighting design with illuminance calculation, turnkey installation, LED retrofit and maintenance: what each service covers. Fictional demo brand.',
    ),
  ],
  projects: [
    pair('Aydınlatma Projeleri: Önce ve Sonra', 'Lighting Projects: Before and After'),
    pair(
      'Otel lobisi, üretim salonu ve müstakil ev dış aydınlatması: önce ve sonra görselleriyle yapılan işler ve sonuçlar. Örnek projeler, kurgusal marka.',
      'A hotel lobby, a production hall and a detached house exterior: what changed, shown with before and after photos. Sample projects, fictional brand.',
    ),
  ],
  blog: [
    pair('Aydınlatma Rehberi: Blog Yazıları', 'Lighting Guides: Blog Articles'),
    pair(
      'Ray spot, lineer aydınlatma, gömme spot, ofis ışığı ve dış mekan armatürleri için seçim ve planlama rehberleri. Kurgusal demo markanın yazıları.',
      'Choosing and planning guides for track spots, linear lighting, recessed spots, office light and outdoor luminaires. Articles of a fictional demo brand.',
    ),
  ],
  references: [
    pair('Aydınlatma Referansları (Örnek İşler)', 'Lighting References (Sample Work)'),
    pair(
      'Otel, konut, ofis, depo ve peyzaj için yapılan aydınlatma işlerinden örnekler. Firma adları ve işler kurgusaldır; bu site bir demodur.',
      'Sample lighting work for hotels, housing, offices, warehouses and parks. The company names and the work are fictional; this site is a demo.',
    ),
  ],
  about: [
    pair(
      'Tanyeri Lighting Hakkında: Kurgusal Aydınlatma Markası',
      'About Tanyeri Lighting, a Fictional Lighting Brand',
    ),
    pair(
      'Tanyeri Lighting, konut, ofis, otel, fabrika ve açık alanlar için aydınlatma ürünleri ve projeleri anlatan kurgusal bir demo markadır. Yaklaşımı burada.',
      'Tanyeri Lighting is a fictional demo brand showing lighting products and projects for homes, offices, hotels, factories and open spaces, and its approach.',
    ),
  ],
  vision: [
    pair('Vizyonumuz: Enerji Verimli Aydınlatma', 'Our Vision: Energy-Efficient Lighting'),
    pair(
      'Yaşanan ve çalışılan her yerde doğru, verimli ve estetik ışık: Tanyeri Lighting demo markasının aydınlatma ve enerji tasarrufu konusundaki ilkeleri.',
      'The right, efficient and well-designed light wherever people live and work: the lighting and energy-saving principles of the Tanyeri Lighting demo brand.',
    ),
  ],
  contact: [
    pair('İletişim ve Proje Talebi', 'Contact and Project Enquiries'),
    pair(
      'Ürün bilgisi veya aydınlatma projeniz için formu kullanın. Adres, telefon ve e-posta kurgusaldır; demo sitede mesajlar gerçek bir kişiye ulaşmaz.',
      'Use the form for product details or a lighting project. The address, phone and email are fictional; on the demo site messages do not reach a person.',
    ),
  ],
  privacy: [
    pair('Gizlilik Politikası', 'Privacy Policy'),
    pair(
      'Tanyeri Lighting demo sitesinin gizlilik politikası örneği: iletişim formunda hangi verilerin istendiği ve nasıl kullanıldığı. Gerçek bir şirket metni değildir.',
      'A sample privacy policy for the Tanyeri Lighting demo site: what the contact form asks for and how it is used. Not the text of a real company.',
    ),
  ],
  terms: [
    pair('Kullanım Koşulları', 'Terms of Use'),
    pair(
      'Tanyeri Lighting demo sitesinin kullanım koşulları örneği: ürünler, adresler ve isimler kurgusaldır, yapılan değişiklikler kaydedilmez.',
      'Sample terms of use for the Tanyeri Lighting demo site: the products, addresses and names are fictional, and changes made here are not saved.',
    ),
  ],
};

const legalPages = {
  privacy: legalPageSchema.parse({
    title: pair('Gizlilik Politikası', 'Privacy Policy'),
    body: pair(
      [
        '## Demo metni',
        'Bu sayfa **kurgusal bir örnektir**. Gerçek bir şirketin gizlilik politikası değildir.',
        '## Hangi veriler toplanır?',
        '- İletişim formuna yazdığınız ad, e-posta, konu ve mesaj.',
        '- Yönetici girişi denemelerinde ve oturum kayıtlarında IP adresi, oturumlarda ayrıca tarayıcı bilgisi saklanır. Ziyaretçilerin IP adresi iletişim formu sınırı için yalnız geri döndürülemeyen bir özet olarak tutulur. Ziyaret istatistiği için kısaltılmış IP adresi, ülke, şehir ve günlük görüntüleme sayısı saklanır ve 13 ay sonra silinir.',
        '## Verilerin kullanımı',
        'Formdaki bilgiler yalnızca size yanıt vermek için kullanılır. Demo sitede gönderilen mesajlar gerçek bir kişiye ulaşmaz.',
      ].join('\n\n'),
      [
        '## Demo text',
        'This page is a **fictional sample**. It is not the privacy policy of a real company.',
        '## What data is collected?',
        '- The name, email, subject and message you write in the contact form.',
        '- Sign-in attempts and session records store the IP address, and sessions also store the browser identification string. For visitors, the contact form limit keeps only a one-way hash of the IP address. Visit statistics store a shortened IP address, country, city and a daily view count, and are deleted after 13 months.',
        '## How the data is used',
        'The form details are only used to reply to you. Messages sent on the demo site do not reach a real person.',
      ].join('\n\n'),
    ),
  }),
  terms: legalPageSchema.parse({
    title: pair('Kullanım Koşulları', 'Terms of Use'),
    body: pair(
      [
        '## Demo metni',
        'Bu sayfa **kurgusal bir örnektir**. Gerçek bir sözleşme değildir.',
        '## Kullanım',
        '- Sitedeki ürünler, adresler ve isimler kurgusaldır.',
        '- Demo sitede yapılan değişiklikler kaydedilmez.',
        '## Sorumluluk',
        'Bu demo yalnızca sitenin nasıl çalıştığını göstermek içindir.',
      ].join('\n\n'),
      [
        '## Demo text',
        'This page is a **fictional sample**. It is not a real agreement.',
        '## Use',
        '- The products, addresses and names on this site are fictional.',
        '- Changes made on the demo site are not saved.',
        '## Liability',
        'This demo only shows how the site works.',
      ].join('\n\n'),
    ),
  }),
};

// The words of each category's own address; the titles have no brand, the site template adds it.
const categories = [
  {
    slug: 'gomme-spot',
    name: pair('Gömme Spot', 'Recessed Spots'),
    seoTitle: pair('Gömme Spot ve Sıva Altı Downlight', 'Recessed Spotlights and LED Downlights'),
    seoDescription: pair(
      'Ofis, mağaza ve konut tavanları için 7-20 W gömme spot ve downlight modelleri. COB, slim ve antiparlama seçenekleri, ölçü bilgileriyle. Demo ürünler.',
      'Recessed spotlights and LED downlights for offices, stores and homes: 7-20 W framed, COB, slim and anti-glare models with sizes listed. Demo products.',
    ),
    h1: pair('Gömme Spot Aydınlatma', 'Recessed Spotlights'),
    intro: pair(
      'Tavana gömülen bu armatürler 7 ile 20 W arasında beş modelde sunulur: çerçeveli, COB, slim, downlight ve antiparlama. Malzeme enjeksiyon alüminyum ve temperli camdır. Çapları 85 ile 150 mm arasındadır; beyaz, siyah ve antrasit renk seçenekleri vardır. Ayrıntılar her ürünün kendi sayfasında yer alır.',
      'Recessed into the ceiling, these fixtures come in five models from 7 to 20 W: framed, COB, slim, downlight and anti-glare. The material is die-cast aluminium and tempered glass. Diameters run from 85 to 150 mm, in white, black and anthracite. The details of each model are on its own product page.',
    ),
  },
  {
    slug: 'sarkit',
    name: pair('Sarkıt', 'Pendants'),
    seoTitle: pair('Sarkıt Aydınlatma ve Halka Sarkıt', 'Pendant Lighting and Ring Pendants'),
    seoDescription: pair(
      'Halka, üçgen ve kare çerçeve sarkıt armatürler: 30-60 W güç, 40-80 cm ölçüler. Ofis, lobi ve yemek alanları için sarkıt aydınlatma. Demo ürünler.',
      'Ring, triangle and square-frame pendant lights from 30 to 60 W and 40 to 80 cm across, for offices, lobbies and dining areas. Demo products.',
    ),
    h1: pair('Sarkıt Aydınlatma', 'Pendant Lighting'),
    intro: pair(
      'Tavandan sarkan beş armatür: tek halka, halka, çift halka, üçgen ve kare çerçeve. Güçleri 30 ile 60 W, ölçüleri 40 ile 80 cm arasındadır. Gövde boyalı çelik, difüzör polikarbonattır; siyah, antrasit ve altın renkleri vardır. Her modelin ölçüleri ve ürün kodu kendi sayfasında listelenir.',
      'Five luminaires that hang from the ceiling: single ring, ring, double ring, triangle and square frame. Power runs from 30 to 60 W and size from 40 to 80 cm. The body is painted steel with a polycarbonate diffuser, in black, anthracite and gold. Each model’s size and product code are listed on its own page.',
    ),
  },
  {
    slug: 'panel',
    name: pair('Panel', 'Panels'),
    seoTitle: pair('LED Panel Armatür ve 60x60 Panel', 'LED Panel Lights, 600x600 and Round'),
    seoDescription: pair(
      'Sıva altı ve sıva üstü LED panel armatürler: 60x60 kare, slim ve yuvarlak modeller, 18-40 W güç. Ofis ve ticari alanlar için ölçülerle. Demo ürünler.',
      'Recessed and surface LED panel lights: 600x600 square, slim and round models from 18 to 40 W for offices and commercial spaces. Demo products.',
    ),
    h1: pair('LED Panel Aydınlatma', 'LED Panel Lights'),
    intro: pair(
      'Sıva altı ve sıva üstü beş LED panel: kare, yuvarlak, slim ve çerçeveli modeller. Güçleri 18 ile 40 W arasındadır; 600x600 mm sıva altı panel de bu gruptadır. Alüminyum profil ve polikarbonat difüzörle gelirler; renkleri beyaz, siyah ve antrasittir. Ölçü ve ürün kodu her ürün sayfasında yazar.',
      'Five LED panels, recessed and surface-mounted: square, round, slim and framed models. Power runs from 18 to 40 W, and the group includes a 600x600 mm recessed panel. They have an aluminium profile and a polycarbonate diffuser, in white, black and anthracite. Size and product code are on each product page.',
    ),
  },
  {
    slug: 'lineer',
    name: pair('Lineer', 'Linear'),
    seoTitle: pair('Lineer Aydınlatma Armatür ve Profil', 'Linear Lighting Fixtures and Profiles'),
    seoDescription: pair(
      'Askılı, sıva üstü ve köşe lineer aydınlatma profilleri ile kare ve üçgen lineer modüller: 36-45 W, 120-150 cm seçenekler ve ölçüler. Demo ürünler.',
      'Suspended, surface and corner linear lighting profiles plus square and triangle modules: 36-45 W, up to 150 cm, with sizes listed. Demo products.',
    ),
    h1: pair('Lineer Aydınlatma', 'Linear Lighting'),
    intro: pair(
      'Lineer aydınlatma, ışığı uzun bir çizgi boyunca verir. Bu grupta askılı, sıva üstü ve köşe profiller ile kare ve üçgen modüller bulunur. Güçleri 36 ile 45 W arasındadır; profillerin boyu 100 ile 150 cm’dir. Alüminyum profil ve polikarbonat difüzör kullanılır; siyah, beyaz ve antrasit seçenekler vardır.',
      'Linear lighting spreads light along a long line. This group has suspended, surface and corner profiles, plus square and triangle modules. Power is 36 to 45 W, and the profiles measure 100 to 150 cm. They use an aluminium profile with a polycarbonate diffuser, in black, white and anthracite.',
    ),
  },
  {
    slug: 'ray-spot',
    name: pair('Ray Spot', 'Track Spots'),
    seoTitle: pair('Ray Spot Modelleri ve Magnet Ray Spot', 'Track Lighting and Magnetic Track Spots'),
    seoDescription: pair(
      'Mağaza, galeri ve konut için 10-30 W ray spot modelleri: silindir, mini, COB ve magnet ray spot seçenekleri, renk ve ölçü bilgileriyle. Demo ürünler.',
      'Track lighting for stores, galleries and homes: 10-30 W cylinder, mini, COB and magnetic track spots, with colours and sizes listed. Demo products.',
    ),
    h1: pair('Ray Spot Aydınlatma', 'Track Lighting'),
    intro: pair(
      'Ray sistemine takılan beş spot: ray spot, silindir, mini, COB ve magnet modeller. Güçleri 10 ile 30 W, çapları 40 ile 85 mm arasındadır. Gövde alüminyumdur; renkler siyah, beyaz ve altındır. Ölçüler ve ürün kodları her ürünün kendi sayfasında listelenir, bilgi talebi de oradan yapılır.',
      'Five spots that mount on a track: track spot, cylinder, mini, COB and magnetic models. Power runs from 10 to 30 W and diameter from 40 to 85 mm. The body is aluminium, in black, white and gold. Sizes and product codes are listed on each product page, and an enquiry can be sent from there too.',
    ),
  },
  {
    slug: 'dis-mekan',
    name: pair('Dış Mekan', 'Outdoor'),
    seoTitle: pair('Dış Mekan Aydınlatma: Bahçe ve Cephe', 'Outdoor Lighting: Garden and Facade'),
    seoDescription: pair(
      'Bahçe armatürü, IP65 yer spotu, bollard, duvar yıkama ve cephe apliği: dış mekan aydınlatma armatürleri, 6-24 W güç ve ölçü bilgileri. Demo ürünler.',
      'Outdoor lighting fixtures: garden luminaires, IP65 in-ground spots, bollards, wall washers and facade lights from 6 to 24 W. Demo products.',
    ),
    h1: pair('Dış Mekan Aydınlatma', 'Outdoor Lighting'),
    intro: pair(
      'Bahçe, yol ve cephe için beş dış mekan armatürü: bahçe armatürü, IP65 yer spotu, duvar yıkama, bollard ve cephe apliği. Güçleri 6 ile 24 W arasındadır. Enjeksiyon alüminyum gövde ve temperli cam kullanılır; renkler antrasit ve siyahtır. Ölçüler ve ürün kodları her ürün sayfasında yer alır.',
      'Five outdoor luminaires for gardens, paths and facades: garden luminaire, IP65 in-ground spot, wall washer, bollard and facade wall light. Power runs from 6 to 24 W. They are made of die-cast aluminium and tempered glass, in anthracite and black. Sizes and product codes are on each product page.',
    ),
  },
].map(({ slug, ...category }) => categorySchema.parse({ key: slug, ...category }));

const colors = {
  black: pair('Siyah', 'Black'),
  white: pair('Beyaz', 'White'),
  anthracite: pair('Antrasit', 'Anthracite'),
  gold: pair('Altın', 'Gold'),
};
const materials = {
  alu: pair('Alüminyum gövde, opal difüzör', 'Aluminium body, opal diffuser'),
  aluPc: pair('Alüminyum profil, polikarbonat difüzör', 'Aluminium profile, polycarbonate diffuser'),
  die: pair('Enjeksiyon alüminyum, temperli cam', 'Die-cast aluminium, tempered glass'),
  steel: pair('Boyalı çelik, polikarbonat difüzör', 'Painted steel, polycarbonate diffuser'),
};

type Row = [
  slug: string,
  tr: string,
  en: string,
  power: string,
  dims: string,
  image: string,
  color: keyof typeof colors,
];

// Fictional technical values and a short description for each demo product, by slug. Light output follows the power
// (about 85-110 lm per watt) and the protection class follows where the fixture is used.
type Details = [flux: string, temperature: string, cri: string, ip: string, tr: string, en: string];

const productDetails: Record<string, Details> = {
  'cerceveli-gomme-spot-7w': [
    '630 lm',
    '3000 K',
    'Ra 80',
    'IP20',
    '7 W gücündeki bu çerçeveli gömme spot, tavana sabit çerçevesiyle düzgün bir görünüm verir. 630 lm ışık akısı ve sıcak beyaz ışığıyla ofis, mağaza ve evlerde genel aydınlatma için uygundur.',
    'This 7 W framed recessed spot sits behind a fixed trim for a clean ceiling line. It gives 630 lm of warm white light, enough for general lighting in offices, stores and homes.',
  ],
  'cob-gomme-spot-15w': [
    '1500 lm',
    '4000 K',
    'Ra 90',
    'IP20',
    'COB LED kaynaklı 15 W gömme spot, tek bir parlak ışık noktası oluşturur. 1500 lm ışık akısı ve Ra 90 renksel geri verimiyle ürünlerin renklerini doğal gösterir; mağaza ve showroom için uygundur.',
    'This 15 W recessed spot uses a COB LED, so the light comes from one bright point. With 1500 lm and a CRI of Ra 90 it shows colours true, which suits stores and showrooms.',
  ],
  'slim-gomme-spot-12w': [
    '1080 lm',
    '4000 K',
    'Ra 80',
    'IP20',
    '25 mm yüksekliğiyle ince tasarlanmış 12 W gömme spottur. Tavan boşluğunun az olduğu yerlerde kullanılabilir ve 1080 lm ile koridor, ofis ve mutfaklara yeterli ışık verir.',
    'A 12 W recessed spot only 25 mm high, made for ceilings with little room above them. Its 1080 lm of neutral white light is enough for corridors, offices and kitchens.',
  ],
  'downlight-18w': [
    '1800 lm',
    '4000 K',
    'Ra 80',
    'IP20',
    '150 mm çapındaki 18 W sıva altı downlight, geniş açılı ve yumuşak bir ışık dağılımı sağlar. 1800 lm ışık akısıyla lobi, ofis ve ticari alanlarda genel aydınlatma için kullanılır.',
    'A 150 mm recessed downlight rated at 18 W, with a wide and soft spread of light. At 1800 lm it serves as general lighting in lobbies, offices and commercial spaces.',
  ],
  'antiparlama-spot-20w': [
    '1800 lm',
    '3000 K',
    'Ra 90',
    'IP20',
    'Derin yuvasıyla ışık kaynağını gizleyen 20 W antiparlama spottur. 1800 lm ışık akısı ve sıcak beyaz ışığı gözü almaz; toplantı odaları, restoranlar ve oteller için uygundur.',
    'This 20 W anti-glare spot hides the light source deep in the housing, so it does not dazzle. Its 1800 lm of warm white light suits meeting rooms, restaurants and hotels.',
  ],
  'halka-sarkit-40w': [
    '3600 lm',
    '3000 K',
    'Ra 80',
    'IP20',
    '600 mm çaplı halka biçimindeki 40 W sarkıt armatür, masa ve tezgâh üzerinde dengeli bir ışık verir. 3600 lm ışık akısıyla ofis, restoran ve karşılama alanlarında kullanılır.',
    'A 40 W pendant luminaire in the shape of a 600 mm ring, giving even light over a table or counter. At 3600 lm it works in offices, restaurants and reception areas.',
  ],
  'cift-halka-sarkit-60w': [
    '5400 lm',
    '3000 K',
    'Ra 80',
    'IP20',
    'İç içe iki halkadan oluşan 60 W sarkıt, 800 mm genişliğiyle geniş masa ve lobilerde dikkat çeker. 5400 lm ışık akısı ve sıcak beyaz ışığı yüksek tavanlı alanlara uygundur.',
    'Two nested rings make up this 60 W pendant, which stands out over a large table or in a lobby at 800 mm wide. Its 5400 lm of warm white light suits spaces with high ceilings.',
  ],
  'ucgen-sarkit-36w': [
    '3240 lm',
    '4000 K',
    'Ra 80',
    'IP20',
    'Üçgen çerçeveli 36 W sarkıt armatür, düz hatlı iç mekânlara geometrik bir vurgu katar. 3240 lm ışık akısı ve nötr beyaz ışığıyla çalışma alanlarında rahat okuma ışığı verir.',
    'A 36 W pendant with a triangular frame that adds a geometric accent to plain interiors. Its 3240 lm of neutral white light gives comfortable light for work areas.',
  ],
  'kare-cerceve-sarkit-48w': [
    '4320 lm',
    '4000 K',
    'Ra 80',
    'IP20',
    '600 x 600 mm kare çerçeveli 48 W sarkıt armatür, ışığı aşağıya doğru geniş bir alana yayar. 4320 lm ışık akısıyla toplantı masaları ve açık ofis alanlarının üstüne uygundur.',
    'A 48 W square-frame pendant, 600 x 600 mm, that spreads its light over a wide area below. At 4320 lm it fits over meeting tables and open-plan offices.',
  ],
  'tek-halka-sarkit-30w': [
    '2700 lm',
    '3000 K',
    'Ra 80',
    'IP20',
    '400 mm çaplı tek halkalı 30 W sarkıt, küçük masalar ve giriş alanları için sade bir seçenektir. 2700 lm ışık akısı ve sıcak beyaz ışığı rahat bir ortam oluşturur.',
    'A single-ring 30 W pendant, 400 mm across, and a simple choice for small tables and entrances. Its 2700 lm of warm white light makes a relaxed setting.',
  ],
  'sivaustu-kare-panel-24w': [
    '2400 lm',
    '4000 K',
    'Ra 80',
    'IP20',
    'Sıva üstü monte edilen 300 x 300 mm kare 24 W LED paneldir. Tavanı oymak gerekmez; 2400 lm ışık akısıyla koridor, depo ve küçük ofislere eşit ve gölgesiz ışık verir.',
    'A 300 x 300 mm square 24 W LED panel that mounts on the surface, so the ceiling does not need to be cut. Its 2400 lm gives even, shadow-free light in corridors, storerooms and small offices.',
  ],
  'yuvarlak-slim-panel-18w': [
    '1800 lm',
    '4000 K',
    'Ra 80',
    'IP20',
    'Yalnızca 20 mm kalınlığındaki 18 W yuvarlak LED panel, 225 mm çapıyla sıva altı yuvaya oturur. 1800 lm ışık akısı ve nötr beyaz ışığı mutfak, banyo girişi ve ofislerde işe yarar.',
    'This 18 W round LED panel is only 20 mm thick and fits a 225 mm recessed opening. Its 1800 lm of neutral white light works in kitchens, hallways and offices.',
  ],
  'sivaalti-panel-600-40w': [
    '4000 lm',
    '4000 K',
    'Ra 80',
    'IP20',
    'Asma tavan modüllerine uyan 595 x 595 mm sıva altı 40 W LED paneldir. 4000 lm ışık akısı ve nötr beyaz ışığıyla ofis, okul ve mağazalarda standart genel aydınlatmayı karşılar.',
    'A 595 x 595 mm recessed 40 W LED panel made for suspended ceiling grids. Its 4000 lm of neutral white light covers standard general lighting in offices, schools and stores.',
  ],
  'sivaustu-yuvarlak-panel-24w': [
    '2400 lm',
    '3000 K',
    'Ra 80',
    'IP20',
    '300 mm çaplı sıva üstü yuvarlak 24 W LED paneldir. Sıcak beyaz 2400 lm ışığı, oturma odası, kafe ve bekleme alanları gibi daha rahat ortamlara uygundur.',
    'A round 24 W surface-mounted LED panel, 300 mm across. Its warm white 2400 lm suits more relaxed settings such as living rooms, cafés and waiting areas.',
  ],
  'cerceveli-kare-panel-36w': [
    '3600 lm',
    '4000 K',
    'Ra 80',
    'IP20',
    '600 x 600 mm çerçeveli 36 W kare panel, kenarlarındaki alüminyum çerçeveyle sağlam ve düzgün bir görünüm verir. 3600 lm ışık akısıyla açık ofis ve toplantı salonlarına uygundur.',
    'A 600 x 600 mm framed 36 W square panel whose aluminium frame gives a solid, tidy look. At 3600 lm it fits open offices and meeting halls.',
  ],
  'kare-lineer-cerceve-40w': [
    '4000 lm',
    '4000 K',
    'Ra 80',
    'IP20',
    '800 x 800 mm ölçüsündeki 40 W kare lineer çerçeve, ince profil çizgileriyle tavanda grafik bir şekil oluşturur. 4000 lm ışık akısıyla mağaza ve ofis için hem aydınlatır hem de dekor katar.',
    'This 40 W square linear frame, 800 x 800 mm, draws a graphic shape on the ceiling with its thin profile lines. At 4000 lm it lights stores and offices and adds to the decor.',
  ],
  'ucgen-lineer-modul-36w': [
    '3600 lm',
    '4000 K',
    'Ra 80',
    'IP20',
    '700 x 700 mm üçgen biçimli 36 W lineer modüldür. Birden çok modül yan yana getirilerek özgün bir tavan deseni kurulabilir; her biri 3600 lm ışık akısı verir.',
    'A triangular 36 W linear module, 700 x 700 mm. Several modules can be placed side by side to build a ceiling pattern, and each one gives 3600 lm.',
  ],
  'askili-lineer-profil-150': [
    '4500 lm',
    '4000 K',
    'Ra 80',
    'IP20',
    '150 cm uzunluğundaki 45 W askılı lineer profil, tavandan askı teli ile sarkar ve ışığı hem aşağı hem yukarı verir. 4500 lm ışık akısı ofis ve atölye çalışma masaları için uygundur.',
    'This 45 W suspended linear profile, 150 cm long, hangs from cables and sends light both down and up. Its 4500 lm suits desks in offices and workshops.',
  ],
  'sivaustu-lineer-120': [
    '3600 lm',
    '4000 K',
    'Ra 80',
    'IP20',
    'Doğrudan tavana vidalanan 120 cm boyunda 36 W lineer armatürdür. Depo, garaj ve teknik alanlarda 3600 lm ile sade ve ekonomik bir aydınlatma sağlar.',
    'A 120 cm, 36 W linear luminaire that screws straight onto the ceiling. At 3600 lm it provides simple and economical lighting in storerooms, garages and utility rooms.',
  ],
  'kose-lineer-profil-45w': [
    '4500 lm',
    '3000 K',
    'Ra 80',
    'IP20',
    'Köşelere uyan L biçimli 45 W lineer profil, iki duvar boyunca kesintisiz bir ışık hattı çizer. 4500 lm ışık akısı ve sıcak beyaz ışığı lobi ve showroom köşelerini öne çıkarır.',
    'An L-shaped 45 W linear profile for corners, drawing an unbroken line of light along two walls. Its 4500 lm of warm white light brings out lobby and showroom corners.',
  ],
  'ray-spot-20w': [
    '1800 lm',
    '3000 K',
    'Ra 90',
    'IP20',
    'Ray sistemine takılan 20 W spot, yönü elle değiştirilebilir. 1800 lm ışık akısı ve Ra 90 renksel geri verimiyle mağaza vitrinleri ve ürün tezgâhları için uygundur.',
    'A 20 W spot for track systems, with a head you can aim by hand. With 1800 lm and a CRI of Ra 90 it suits shop windows and product counters.',
  ],
  'silindir-ray-spot-25w': [
    '2250 lm',
    '3000 K',
    'Ra 90',
    'IP20',
    'Silindir gövdeli 25 W ray spot, dar bir ışık huzmesiyle belirli bir noktayı vurgular. 2250 lm ışık akısıyla galeri duvarları ve mağaza reyonlarında kullanılır.',
    'A 25 W track spot in a cylinder body, using a narrow beam to pick out one point. At 2250 lm it is used on gallery walls and store shelves.',
  ],
  'mini-ray-spot-12w': [
    '1080 lm',
    '3000 K',
    'Ra 90',
    'IP20',
    '50 mm çapıyla küçük kalan 12 W ray spot, evlerde ve butiklerde göze batmadan ışık verir. 1080 lm ışık akısı tablo, raf ve küçük sergi alanları için yeterlidir.',
    'At 50 mm across, this 12 W track spot stays small and gives light without drawing the eye in homes and boutiques. Its 1080 lm is enough for pictures, shelves and small displays.',
  ],
  'ray-spot-cob-30w': [
    '2850 lm',
    '4000 K',
    'Ra 90',
    'IP20',
    'COB LED kaynaklı 30 W ray spot, güçlü ve temiz bir ışık verir. 2850 lm ışık akısı ve Ra 90 renksel geri verimiyle yüksek tavanlı mağaza ve showroomlar için uygundur.',
    'A 30 W track spot with a COB LED that gives strong, clean light. With 2850 lm and a CRI of Ra 90 it suits stores and showrooms with high ceilings.',
  ],
  'magnet-ray-spot-10w': [
    '900 lm',
    '3000 K',
    'Ra 90',
    'IP20',
    'Manyetik ray üzerine tutturulan 10 W spottur ve yeri kolayca değiştirilir. 900 lm ışık akısı ve sıcak beyaz ışığıyla ev, ofis ve sergi alanlarında esnek bir vurgu ışığıdır.',
    'A 10 W spot that clips onto a magnetic track, so it is easy to move. Its 900 lm of warm white light is a flexible accent for homes, offices and display areas.',
  ],
  'bahce-armaturu-10w': [
    '800 lm',
    '3000 K',
    'Ra 70',
    'IP65',
    '350 mm yüksekliğindeki 10 W bahçe armatürü, patikaları ve çalılıkları yumuşak bir ışıkla aydınlatır. IP65 koruma sınıfı yağmura ve toza karşı dayanıklıdır; 800 lm ışık akısı sıcak beyazdır.',
    'A 10 W garden luminaire, 350 mm tall, that lights paths and planting with soft light. Its IP65 rating protects against rain and dust, and its 800 lm output is warm white.',
  ],
  'yer-spotu-ip65-6w': [
    '480 lm',
    '3000 K',
    'Ra 70',
    'IP65',
    'Zemine gömülen 6 W yer spotu, ağaçları ve duvar diplerini aşağıdan yukarıya aydınlatır. IP65 koruma sınıfı su püskürtmesine ve toza dayanır; 480 lm ışık akısı sıcak beyazdır.',
    'A 6 W in-ground spot set into the ground to light trees and wall bases from below. Its IP65 rating withstands water jets and dust, and its 480 lm output is warm white.',
  ],
  'duvar-yikama-24w': [
    '2160 lm',
    '4000 K',
    'Ra 80',
    'IP66',
    '1000 mm boyundaki 24 W duvar yıkama armatürü, cephe ve duvar yüzeylerini baştan sona eşit ışıkla boyar. IP66 koruma sınıfı şiddetli yağmura dayanır; 2160 lm ışık akısı nötr beyazdır.',
    'A 24 W wall washer, 1000 mm long, that covers facades and walls from end to end with even light. Its IP66 rating handles heavy rain, and its 2160 lm output is neutral white.',
  ],
  'bollard-yol-8w': [
    '640 lm',
    '3000 K',
    'Ra 70',
    'IP65',
    '800 mm yüksekliğindeki 8 W bollard, yaya yollarını ve park girişlerini göz hizasının altından aydınlatır. IP65 koruma sınıfı dış mekâna uygundur; 640 lm ışık akısı sıcak beyazdır.',
    'An 8 W bollard, 800 mm tall, that lights footpaths and car park entrances from below eye level. Its IP65 rating suits outdoor use, and its 640 lm output is warm white.',
  ],
  'cephe-aplik-12w': [
    '960 lm',
    '3000 K',
    'Ra 80',
    'IP54',
    'Bina girişlerine ve teras duvarlarına takılan 12 W cephe apliğidir. Işığı hem yukarı hem aşağı verir; IP54 koruma sınıfı çatı altı ve korunaklı dış duvarlar için yeterlidir. Işık akısı 960 lm, renk sıcak beyazdır.',
    'A 12 W facade wall light for building entrances and terrace walls. It sends light both up and down, and its IP54 rating is enough for sheltered outer walls under a roof. It gives 960 lm of warm white light.',
  ],
};

// Five products per category, in the order of `categories`.
const productRows: Record<string, { code: string; material: keyof typeof materials; rows: Row[] }> = {
  'gomme-spot': {
    code: 'GS',
    material: 'die',
    rows: [
      [
        'cerceveli-gomme-spot-7w',
        'Çerçeveli Gömme Spot 7W',
        'Framed Recessed Spot 7W',
        '7 W',
        'Ø 85 x 40 mm',
        'product-gomme-spot',
        'white',
      ],
      [
        'cob-gomme-spot-15w',
        'COB Gömme Spot 15W',
        'COB Recessed Spot 15W',
        '15 W',
        'Ø 100 x 55 mm',
        'product-cob-spot',
        'white',
      ],
      [
        'slim-gomme-spot-12w',
        'Slim Gömme Spot 12W',
        'Slim Recessed Spot 12W',
        '12 W',
        'Ø 120 x 25 mm',
        'product-slim-panel',
        'white',
      ],
      [
        'downlight-18w',
        'Sıva Altı Downlight 18W',
        'Recessed Downlight 18W',
        '18 W',
        'Ø 150 x 60 mm',
        'product-gomme-spot',
        'black',
      ],
      [
        'antiparlama-spot-20w',
        'Antiparlama Spot 20W',
        'Anti-glare Spot 20W',
        '20 W',
        'Ø 110 x 70 mm',
        'product-cob-spot',
        'anthracite',
      ],
    ],
  },
  sarkit: {
    code: 'SR',
    material: 'steel',
    rows: [
      [
        'halka-sarkit-40w',
        'Halka Sarkıt Armatür 40W',
        'Ring Pendant Luminaire 40W',
        '40 W',
        'Ø 600 x 50 mm',
        'product-halka-sarkit',
        'black',
      ],
      [
        'cift-halka-sarkit-60w',
        'Çift Halka Sarkıt 60W',
        'Double Ring Pendant 60W',
        '60 W',
        'Ø 800 x 400 mm',
        'product-cift-halka-sarkit',
        'black',
      ],
      [
        'ucgen-sarkit-36w',
        'Üçgen Sarkıt 36W',
        'Triangle Pendant 36W',
        '36 W',
        '600 x 600 x 40 mm',
        'product-ucgen-sarkit',
        'anthracite',
      ],
      [
        'kare-cerceve-sarkit-48w',
        'Kare Çerçeve Sarkıt 48W',
        'Square Frame Pendant 48W',
        '48 W',
        '600 x 600 x 40 mm',
        'product-kare-sarkit',
        'black',
      ],
      [
        'tek-halka-sarkit-30w',
        'Tek Halka Sarkıt 30W',
        'Single Ring Pendant 30W',
        '30 W',
        'Ø 400 x 40 mm',
        'product-tek-halka',
        'gold',
      ],
    ],
  },
  panel: {
    code: 'PN',
    material: 'aluPc',
    rows: [
      [
        'sivaustu-kare-panel-24w',
        'Sıva Üstü Kare Panel 24W',
        'Surface Square Panel 24W',
        '24 W',
        '300 x 300 x 50 mm',
        'product-kare-panel',
        'white',
      ],
      [
        'yuvarlak-slim-panel-18w',
        'Yuvarlak Slim Panel 18W',
        'Round Slim Panel 18W',
        '18 W',
        'Ø 225 x 20 mm',
        'product-slim-panel',
        'white',
      ],
      [
        'sivaalti-panel-600-40w',
        'Sıva Altı Panel 600x600 40W',
        'Recessed Panel 600x600 40W',
        '40 W',
        '595 x 595 x 30 mm',
        'product-kare-panel',
        'white',
      ],
      [
        'sivaustu-yuvarlak-panel-24w',
        'Sıva Üstü Yuvarlak Panel 24W',
        'Surface Round Panel 24W',
        '24 W',
        'Ø 300 x 45 mm',
        'product-slim-panel',
        'black',
      ],
      [
        'cerceveli-kare-panel-36w',
        'Çerçeveli Kare Panel 36W',
        'Framed Square Panel 36W',
        '36 W',
        '600 x 600 x 60 mm',
        'product-kare-panel',
        'anthracite',
      ],
    ],
  },
  lineer: {
    code: 'LN',
    material: 'aluPc',
    rows: [
      [
        'kare-lineer-cerceve-40w',
        'Kare Lineer Çerçeve 40W',
        'Square Linear Frame 40W',
        '40 W',
        '800 x 800 x 35 mm',
        'product-kare-sarkit',
        'black',
      ],
      [
        'ucgen-lineer-modul-36w',
        'Üçgen Lineer Modül 36W',
        'Triangle Linear Module 36W',
        '36 W',
        '700 x 700 x 35 mm',
        'product-ucgen-sarkit',
        'black',
      ],
      [
        'askili-lineer-profil-150',
        'Askılı Lineer Profil 150 cm',
        'Suspended Linear Profile 150 cm',
        '45 W',
        '1500 x 50 x 60 mm',
        'product-kare-sarkit',
        'anthracite',
      ],
      [
        'sivaustu-lineer-120',
        'Sıva Üstü Lineer 120 cm',
        'Surface Linear 120 cm',
        '36 W',
        '1200 x 40 x 50 mm',
        'product-kare-panel',
        'white',
      ],
      [
        'kose-lineer-profil-45w',
        'Köşe Lineer Profil 45W',
        'Corner Linear Profile 45W',
        '45 W',
        '1000 x 1000 x 35 mm',
        'product-kare-sarkit',
        'black',
      ],
    ],
  },
  'ray-spot': {
    code: 'RS',
    material: 'alu',
    rows: [
      ['ray-spot-20w', 'Ray Spot 20W', 'Track Spot 20W', '20 W', 'Ø 70 x 130 mm', 'product-cob-spot', 'black'],
      [
        'silindir-ray-spot-25w',
        'Silindir Ray Spot 25W',
        'Cylinder Track Spot 25W',
        '25 W',
        'Ø 75 x 150 mm',
        'product-gomme-spot',
        'white',
      ],
      [
        'mini-ray-spot-12w',
        'Mini Ray Spot 12W',
        'Mini Track Spot 12W',
        '12 W',
        'Ø 50 x 100 mm',
        'product-cob-spot',
        'white',
      ],
      [
        'ray-spot-cob-30w',
        'Ray Spot COB 30W',
        'Track Spot COB 30W',
        '30 W',
        'Ø 85 x 170 mm',
        'product-cob-spot',
        'gold',
      ],
      [
        'magnet-ray-spot-10w',
        'Magnet Ray Spot 10W',
        'Magnetic Track Spot 10W',
        '10 W',
        'Ø 40 x 90 mm',
        'product-gomme-spot',
        'black',
      ],
    ],
  },
  'dis-mekan': {
    code: 'DM',
    material: 'die',
    rows: [
      [
        'bahce-armaturu-10w',
        'Bahçe Armatürü 10W',
        'Garden Luminaire 10W',
        '10 W',
        'Ø 100 x 350 mm',
        'product-bahce',
        'anthracite',
      ],
      [
        'yer-spotu-ip65-6w',
        'Yer Spotu IP65 6W',
        'In-ground Spot IP65 6W',
        '6 W',
        'Ø 90 x 110 mm',
        'product-teras',
        'anthracite',
      ],
      [
        'duvar-yikama-24w',
        'Duvar Yıkama Armatürü 24W',
        'Wall Washer 24W',
        '24 W',
        '1000 x 60 x 70 mm',
        'product-cephe',
        'black',
      ],
      [
        'bollard-yol-8w',
        'Bollard Yol Armatürü 8W',
        'Bollard Path Luminaire 8W',
        '8 W',
        'Ø 110 x 800 mm',
        'product-bahce',
        'anthracite',
      ],
      [
        'cephe-aplik-12w',
        'Cephe Aplik 12W',
        'Facade Wall Light 12W',
        '12 W',
        '180 x 90 x 90 mm',
        'product-cephe',
        'black',
      ],
    ],
  },
};

// The home page shows these six, in this order.
const featuredSlugs = [
  'halka-sarkit-40w',
  'cob-gomme-spot-15w',
  'sivaustu-kare-panel-24w',
  'cift-halka-sarkit-60w',
  'ucgen-lineer-modul-36w',
  'kare-lineer-cerceve-40w',
];

const catalogs = [
  { file: 'catalog-2026', name: pair('Genel Katalog 2026', 'General Catalog 2026') },
  { file: 'catalog-dekoratif', name: pair('Dekoratif Aydınlatma Kataloğu', 'Decorative Lighting Catalog') },
  { file: 'catalog-dis-mekan', name: pair('Dış Mekan Kataloğu', 'Outdoor Lighting Catalog') },
];

const promoBoards = [
  {
    image: 'promo-dekoratif.webp',
    title: pair('Dekoratif Aydınlatma', 'Decorative Lighting'),
    subtitle: pair('Sıcak ve etkileyici ışık', 'Warm, striking light'),
  },
  {
    image: 'promo-yasam.webp',
    title: pair('Yaşam Alanları', 'Living Spaces'),
    subtitle: pair('Evinize uygun konfor', 'Comfort that suits your home'),
  },
  {
    image: 'promo-dis-mekan.webp',
    title: pair('Dış Mekan', 'Outdoor'),
    subtitle: pair('Her havaya dayanıklı', 'Built for every weather'),
  },
];

const homeBanner = homeBannerSchema.parse({
  imageUrl: img('banner.webp'),
  imageAlt: describeImage('banner.webp'),
  title: pair('Her mekâna doğru LED aydınlatma', 'The right LED light for every space'),
  description: pair(
    'Konuttan endüstriyel tesise, enerji verimli ve estetik aydınlatma çözümleri tasarlıyor, üretiyor ve uyguluyoruz.',
    'From homes to industrial sites, we design, make and install energy-efficient, well-designed lighting.',
  ),
  primaryAction: { label: pair('Ürünleri İncele', 'View Products'), target: 'products' },
  secondaryAction: { label: pair('İletişime Geç', 'Get in Touch'), target: 'contact' },
});

// The last item is the category the card links to; Industrial Sites has no matching category.
const areas = [
  [
    'area-konut.webp',
    'Konut',
    'Homes',
    'Yaşam alanlarına uygun, göz yormayan ve enerji verimli aydınlatma çözümleri.',
    'Comfortable, glare-free and energy-efficient lighting for living spaces.',
    'gomme-spot',
  ],
  [
    'area-ofis.webp',
    'Ofis ve Ticari Alanlar',
    'Offices and Commercial Spaces',
    'Verimliliği artıran, mekâna kimlik kazandıran lineer ve panel sistemleri.',
    'Linear and panel systems that raise productivity and give a space its character.',
    'lineer',
  ],
  [
    'area-endustriyel.webp',
    'Endüstriyel Tesisler',
    'Industrial Sites',
    'Yüksek tavanlı üretim ve depo alanları için dayanıklı aydınlatma.',
    'Durable lighting for high-ceiling production halls and warehouses.',
    null,
  ],
  [
    'area-otel.webp',
    'Otel ve Mağaza',
    'Hotels and Stores',
    'Misafirleri karşılayan, ürünü öne çıkaran sıcak ve dengeli ışık planları.',
    'Warm, balanced lighting plans that welcome guests and show products at their best.',
    'ray-spot',
  ],
  [
    'area-peyzaj.webp',
    'Peyzaj',
    'Landscape',
    'Bahçe, yol ve park aydınlatmasında güvenli ve estetik uygulamalar.',
    'Safe and attractive lighting for gardens, paths and parks.',
    'dis-mekan',
  ],
  [
    'area-cephe.webp',
    'Dış Cephe',
    'Facades',
    'Yapının karakterini gece de koruyan cephe ve giriş aydınlatması.',
    'Facade and entrance lighting that keeps the character of a building at night.',
    'dis-mekan',
  ],
] as const;

const services = [
  {
    imageUrl: img('service-tasarim.webp'),
    imageAlt: describeImage('service-tasarim.webp'),
    title: pair('Aydınlatma Tasarımı', 'Lighting Design'),
    description: pair(
      'Mekânı ve kullanımı inceleyip **ışık planını** çiziyoruz.\n\n- Aydınlık düzeyi hesabı\n- [Armatür](/tr/urunler) seçimi ve yerleşimi\n- Kontrol ve dimleme önerisi',
      'We study the space and how it is used, then draw the **lighting plan**.\n\n- Illuminance calculation\n- [Luminaire](/en/products) choice and layout\n- Control and dimming proposal',
    ),
    note: pair('İlk keşif görüşmesi ücretsizdir (demo).', 'The first survey visit is free (demo).'),
  },
  {
    imageUrl: img('service-uygulama.webp'),
    imageAlt: describeImage('service-uygulama.webp'),
    title: pair('Proje ve Uygulama', 'Installation'),
    description: pair(
      'Onaylanan planı **anahtar teslim** uyguluyoruz; tamamlanan işler [projeler](/tr/projeler) sayfasında.\n\n- Montaj ve kablolama\n- Devreye alma ve ayar\n- Teslim sonrası ölçüm',
      'We install the approved plan **turnkey**; finished work is on the [projects](/en/projects) page.\n\n- Fitting and wiring\n- Commissioning and adjustment\n- Measurements after handover',
    ),
    note: pair('', ''),
  },
  {
    imageUrl: img('service-yenileme.webp'),
    imageAlt: describeImage('service-yenileme.webp'),
    title: pair('Yenileme ve Verimlilik', 'Retrofit and Efficiency'),
    description: pair(
      'Eski armatürleri **LED** ile değiştirerek enerji tüketimini düşürüyoruz.\n\n- Mevcut durum analizi\n- Tasarruf tahmini\n- Aşamalı geçiş planı',
      'We replace old luminaires with **LED** to cut energy use.\n\n- Analysis of the current state\n- Savings estimate\n- Phased changeover plan',
    ),
    note: pair('', ''),
  },
  {
    imageUrl: img('area-ofis.webp'),
    imageAlt: describeImage('area-ofis.webp'),
    title: pair('Danışmanlık ve Bakım', 'Consulting and Maintenance'),
    description: pair(
      'Tamamlanan işler için **bakım ve teknik destek** veriyoruz.\n\n- Periyodik kontrol\n- Yedek parça ve sürücü değişimi\n- Telefonla destek ([iletişim](/tr/iletisim))',
      'We give **maintenance and technical support** for finished work.\n\n- Periodic checks\n- Spare parts and driver replacement\n- Support by phone ([contact](/en/contact))',
    ),
    note: pair('Destek saatleri çalışma saatleriyle aynıdır.', 'Support hours are the same as working hours.'),
  },
].map((service) => serviceSchema.parse(service));

const aboutPage = aboutPageSchema.parse({
  body: pair(
    [
      'Tanyeri Lighting, **kurgusal bir demo şirketidir.** Bu metin sitenin hakkımızda sayfasını göstermek için yazılmıştır.',
      'Konut, ofis, otel, fabrika ve açık alanlar için aydınlatma ürünleri geliştirir ve projelendirir. Her işe mekânı ve kullanımı anlayarak başlar, ürünü o ihtiyaca göre seçeriz.',
      '## Yaklaşımımız\n\n- Önce ihtiyaç, sonra ürün.\n- Enerji verimli ve uzun ömürlü armatürler.\n- Tasarımdan bakıma kadar tek muhatap.',
    ].join('\n\n'),
    [
      'Tanyeri Lighting is a **fictional demo company.** This text exists to show the about page of the site.',
      'It develops and plans lighting products for homes, offices, hotels, factories and open spaces. Each job starts by understanding the space and how it is used, and the product follows that need.',
      '## Our approach\n\n- The need first, then the product.\n- Energy-efficient, long-lasting luminaires.\n- One contact from design to maintenance.',
    ].join('\n\n'),
  ),
  vision: pair(
    'İnsanların yaşadığı ve çalıştığı her yerde **doğru, verimli ve estetik ışık** sunmak; aydınlatmayı enerji tasarrufunun bir parçası olarak görmek.',
    'To offer **the right, efficient and well-designed light** wherever people live and work, and to treat lighting as part of saving energy.',
  ),
});

const projects = [
  {
    files: 'project-konut',
    title: pair('Orman Evi Dış Aydınlatma', 'Forest House Exterior Lighting'),
    description: pair(
      'Müstakil bir evin cephesi, girişi ve bahçe yolu yeniden aydınlatıldı.\n\n- **Cephe:** sıcak beyaz duvar yıkama\n- **Yol:** düşük seviyeli [bollard armatürler](/tr/urunler?category=dis-mekan)',
      'The facade, entrance and garden path of a detached house were relit.\n\n- **Facade:** warm white wall washing\n- **Path:** low-level [bollard luminaires](/en/products?category=dis-mekan)',
    ),
  },
  {
    files: 'project-otel',
    title: pair('Otel Lobisi Yenileme', 'Hotel Lobby Refit'),
    description: pair(
      'Lobi tavanındaki eski armatürler **LED** ile değiştirildi ve tavan hattına gizli [lineer](/tr/urunler?category=lineer) ışık eklendi.\n\n- Enerji tüketimi yarıya indi (örnek değer)\n- Daha sıcak ve dengeli ışık',
      'The old ceiling luminaires of the lobby were replaced with **LED** and a hidden [linear](/en/products?category=lineer) light line was added.\n\n- Energy use fell by half (sample figure)\n- Warmer, more even light',
    ),
  },
  {
    files: 'project-fabrika',
    title: pair('Üretim Salonu Aydınlatması', 'Production Hall Lighting'),
    description: pair(
      'Yüksek tavanlı üretim salonuna **yüksek verimli** [armatürler](/tr/urunler) yerleştirildi.\n\n- Çalışma düzleminde eşit aydınlık\n- Daha az bakım gerektiren sürücüler',
      'Highly efficient [luminaires](/en/products) were fitted in a high-ceiling production hall.\n\n- Even light on the work plane\n- Drivers that need less maintenance',
    ),
  },
].map(({ files, title, description }) =>
  projectSchema.parse({
    title,
    description,
    beforeImageUrl: img(`${files}-before.webp`),
    afterImageUrl: img(`${files}-after.webp`),
  }),
);

const references = [
  {
    imageUrl: img('area-otel.webp'),
    imageAlt: describeImage('area-otel.webp'),
    name: 'Örnek Otel İşletmeleri',
    title: pair('Otel aydınlatması', 'Hotel lighting'),
    description: pair(
      'Lobi ve koridorlar için dekoratif ve genel aydınlatma.',
      'Decorative and general lighting for lobbies and corridors.',
    ),
  },
  {
    imageUrl: img('area-konut.webp'),
    imageAlt: describeImage('area-konut.webp'),
    name: 'Demo Konut Yapı',
    title: pair('Konut projesi', 'Housing project'),
    description: pair(
      'Yaşam alanları için panel ve gömme spot çözümleri.',
      'Panel and recessed spot solutions for living spaces.',
    ),
  },
  {
    imageUrl: img('area-ofis.webp'),
    imageAlt: describeImage('area-ofis.webp'),
    name: 'Lorem Plaza',
    title: pair('Ofis binası', 'Office building'),
    description: pair(
      'Açık ofis katları için lineer aydınlatma sistemi.',
      'A linear lighting system for open-plan office floors.',
    ),
  },
  {
    imageUrl: img('area-endustriyel.webp'),
    imageAlt: describeImage('area-endustriyel.webp'),
    name: 'Example Lojistik',
    title: pair('Depo ve lojistik', 'Warehouse and logistics'),
    description: pair(
      'Yüksek tavanlı depo için endüstriyel armatürler.',
      'Industrial luminaires for a high-bay warehouse.',
    ),
  },
  {
    imageUrl: img('area-peyzaj.webp'),
    imageAlt: describeImage('area-peyzaj.webp'),
    name: 'Demo Peyzaj Parkı',
    title: pair('Peyzaj aydınlatması', 'Landscape lighting'),
    description: pair(
      'Park yolları ve bahçeler için direk ve zemin armatürleri.',
      'Pole and ground luminaires for park paths and gardens.',
    ),
  },
].map((reference) => referenceSchema.parse(reference));

export interface SeedCounts {
  categories: number;
  products: number;
  catalogs: number;
  promoBoards: number;
  featuredProducts: number;
  applicationAreas: number;
  services: number;
  projects: number;
  references: number;
  socialLinks: number;
  pageMetadata: number;
  legalPages: number;
  blogPosts: number;
}

// Replaces all site content with the demo content, in one transaction, so a second run leaves the same content. Users
// and sessions are not touched. Content that already exists is only replaced when the caller says so.
export async function seedDemoContent(db: PrismaClient, options: { replace?: boolean } = {}): Promise<SeedCounts> {
  if (!options.replace) {
    const existing =
      (await db.siteSettings.count()) +
      (await db.category.count()) +
      (await db.project.count()) +
      (await db.catalog.count());
    if (existing > 0) {
      throw new Error('Site content already exists. Run again with --replace to overwrite it with the demo content.');
    }
  }
  const catalogRows = catalogs.map((catalog) =>
    catalogSchema.parse({
      name: catalog.name,
      pdfUrl: img(`${catalog.file}.pdf`),
      coverImageUrl: img(`${catalog.file}-cover.webp`),
      imageAlt: describeImage(`${catalog.file}-cover.webp`),
      sizeBytes: pdfSize(`${catalog.file}.pdf`),
    }),
  );
  const areaRows = areas.map(([file, tr, en, descriptionTr, descriptionEn, categoryKey]) => ({
    ...applicationAreaSchema.parse({
      imageUrl: img(file),
      imageAlt: describeImage(file),
      title: pair(tr, en),
      description: pair(descriptionTr, descriptionEn),
      categoryId: null,
    }),
    categoryKey,
  }));

  const blogRows = demoBlogPosts.map((post) => ({ ...blogPostSchema.parse(post), publishedAt: post.publishedAt }));

  return db.$transaction(
    async (tx) => {
      await tx.featuredProduct.deleteMany();
      await tx.promoBoard.deleteMany();
      await tx.catalog.deleteMany();
      await tx.product.deleteMany();
      await tx.category.deleteMany();
      await Promise.all([
        tx.socialLink.deleteMany(),
        tx.applicationArea.deleteMany(),
        tx.service.deleteMany(),
        tx.blogPost.deleteMany(),
        tx.project.deleteMany(),
        tx.reference.deleteMany(),
      ]);

      const { logoUrl, phone, email } = settings;
      const settingsData = {
        logoUrl,
        phone,
        email,
        ...toColumns('siteName', settings.siteName),
        ...toColumns('address', settings.address),
        ...toColumns('workingHours', settings.workingHours),
        ...toColumns('serviceArea', settings.serviceArea),
        ...toColumns('languages', settings.languages),
      };
      await tx.siteSettings.upsert({
        where: { id: 'site' },
        create: { id: 'site', ...settingsData },
        update: settingsData,
      });

      await tx.socialLink.createMany({
        data: socialLinks.map((link, position) => ({
          platform: link.platform,
          ...toColumns('label', link.label),
          url: link.url,
          position,
        })),
      });

      for (const [pageKey, [title, description]] of Object.entries(pageMetadata)) {
        const parsed = pageMetadataSchema.parse({ title, description });
        const data = { ...toColumns('title', parsed.title), ...toColumns('description', parsed.description) };
        await tx.pageMetadata.upsert({ where: { pageKey }, create: { pageKey, ...data }, update: data });
      }

      for (const [pageKey, page] of Object.entries(legalPages)) {
        const data = { ...toColumns('title', page.title), ...toColumns('body', page.body) };
        await tx.legalPage.upsert({ where: { pageKey }, create: { pageKey, ...data }, update: data });
      }

      const categoryIds = new Map<string, string>();
      const productIds = new Map<string, string>();
      let productCount = 0;
      for (const [categoryPosition, category] of categories.entries()) {
        const row = await tx.category.create({
          data: {
            key: category.key,
            ...toColumns('name', category.name),
            ...toColumns('seoTitle', category.seoTitle),
            ...toColumns('seoDescription', category.seoDescription),
            ...toColumns('h1', category.h1),
            ...toColumns('intro', category.intro),
            sortOrder: categoryPosition,
          },
        });
        categoryIds.set(category.key, row.id);
        const group = productRows[category.key];
        if (!group) throw new Error(`No products for the category ${category.key}`);
        for (const [position, [slug, tr, en, power, dimensions, image, color]] of group.rows.entries()) {
          const details = productDetails[slug];
          if (!details) throw new Error(`No details for the product ${slug}`);
          const [luminousFlux, colorTemperature, cri, ip, descriptionTr, descriptionEn] = details;
          const product = productSchema.parse({
            categoryId: row.id,
            slug,
            code: `TL-${group.code}-${String(position + 1).padStart(3, '0')}`,
            name: pair(tr, en),
            color: colors[color],
            material: materials[group.material],
            power,
            dimensions,
            description: pair(descriptionTr, descriptionEn),
            luminousFlux,
            colorTemperature,
            cri,
            ip,
            imageUrl: img(`${image}.webp`),
          });
          const created = await tx.product.create({
            data: {
              categoryId: product.categoryId,
              slug: product.slug,
              code: product.code,
              ...toColumns('name', product.name),
              ...toColumns('color', product.color),
              ...toColumns('material', product.material),
              power: product.power,
              dimensions: product.dimensions,
              ...toColumns('description', product.description),
              luminousFlux: product.luminousFlux,
              colorTemperature: product.colorTemperature,
              cri: product.cri,
              ip: product.ip,
              imageUrl: product.imageUrl,
              sortOrder: position,
            },
          });
          productIds.set(slug, created.id);
          productCount += 1;
        }
      }

      const featuredIds = featuredProductIdsSchema.parse(
        featuredSlugs.map((slug) => {
          const id = productIds.get(slug);
          if (!id) throw new Error(`Unknown featured product ${slug}`);
          return id;
        }),
      );
      await tx.featuredProduct.createMany({
        data: featuredIds.map((productId, sortOrder) => ({ productId, sortOrder })),
      });

      const catalogIds: string[] = [];
      for (const [sortOrder, catalog] of catalogRows.entries()) {
        const row = await tx.catalog.create({
          data: {
            ...toColumns('name', catalog.name),
            pdfUrl: catalog.pdfUrl,
            coverImageUrl: catalog.coverImageUrl,
            ...toColumns('imageAlt', catalog.imageAlt),
            sizeBytes: catalog.sizeBytes,
            sortOrder,
          },
        });
        catalogIds.push(row.id);
      }

      for (const [sortOrder, board] of promoBoards.entries()) {
        const catalogId = catalogIds[sortOrder];
        if (!catalogId) throw new Error('A promo board needs a catalog');
        const parsed = promoBoardSchema.parse({
          imageUrl: img(board.image),
          imageAlt: describeImage(board.image),
          title: board.title,
          subtitle: board.subtitle,
          catalogId,
        });
        await tx.promoBoard.create({
          data: {
            imageUrl: parsed.imageUrl,
            ...toColumns('imageAlt', parsed.imageAlt),
            ...toColumns('title', parsed.title),
            ...toColumns('subtitle', parsed.subtitle),
            catalogId,
            sortOrder,
          },
        });
      }

      const bannerData = {
        imageUrl: homeBanner.imageUrl,
        ...toColumns('imageAlt', homeBanner.imageAlt),
        ...toColumns('title', homeBanner.title),
        ...toColumns('description', homeBanner.description),
        ...toColumns('primaryLabel', homeBanner.primaryAction.label),
        primaryTarget: homeBanner.primaryAction.target,
        ...toColumns('secondaryLabel', homeBanner.secondaryAction.label),
        secondaryTarget: homeBanner.secondaryAction.target,
      };
      await tx.homeBanner.upsert({ where: { id: 'home' }, create: { id: 'home', ...bannerData }, update: bannerData });

      await tx.applicationArea.createMany({
        data: areaRows.map((area, sortOrder) => ({
          imageUrl: area.imageUrl,
          ...toColumns('imageAlt', area.imageAlt),
          ...toColumns('title', area.title),
          ...toColumns('description', area.description),
          categoryId: area.categoryKey ? (categoryIds.get(area.categoryKey) ?? null) : null,
          sortOrder,
        })),
      });

      await tx.service.createMany({
        data: services.map((service, sortOrder) => ({
          imageUrl: service.imageUrl,
          ...toColumns('imageAlt', service.imageAlt),
          ...toColumns('title', service.title),
          ...toColumns('description', service.description),
          ...toColumns('note', service.note),
          sortOrder,
        })),
      });

      const aboutData = { ...toColumns('body', aboutPage.body), ...toColumns('vision', aboutPage.vision) };
      await tx.aboutPage.upsert({ where: { id: 'about' }, create: { id: 'about', ...aboutData }, update: aboutData });

      await tx.project.createMany({
        data: projects.map((project, sortOrder) => ({
          ...toColumns('title', project.title),
          ...toColumns('description', project.description),
          beforeImageUrl: project.beforeImageUrl,
          afterImageUrl: project.afterImageUrl,
          sortOrder,
        })),
      });

      await tx.reference.createMany({
        data: references.map((reference, sortOrder) => ({
          imageUrl: reference.imageUrl,
          ...toColumns('imageAlt', reference.imageAlt),
          name: reference.name,
          ...toColumns('title', reference.title),
          ...toColumns('description', reference.description),
          sortOrder,
        })),
      });

      await tx.blogPost.createMany({
        data: blogRows.map((post) => ({
          slug: post.slug,
          imageUrl: post.imageUrl,
          publishedAt: post.publishedAt,
          updatedAt: post.publishedAt,
          ...toColumns('title', post.title),
          ...toColumns('description', post.description),
          ...toColumns('excerpt', post.excerpt),
          ...toColumns('body', post.body),
          ...toColumns('imageAlt', post.imageAlt),
        })),
      });

      return {
        categories: categories.length,
        products: productCount,
        catalogs: catalogRows.length,
        promoBoards: promoBoards.length,
        featuredProducts: featuredIds.length,
        applicationAreas: areaRows.length,
        services: services.length,
        projects: projects.length,
        references: references.length,
        socialLinks: socialLinks.length,
        pageMetadata: Object.keys(pageMetadata).length,
        legalPages: Object.keys(legalPages).length,
        blogPosts: blogRows.length,
      };
    },
    { timeout: 60_000 },
  );
}
