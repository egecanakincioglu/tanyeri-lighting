// The fictional content of the public demo: Turkish and English, with pictures from public/demo. Every record goes
// through the zod schemas of the content services. Prisma is used directly because the write services refuse to run in
// demo mode. Everything here is made up: names, address, phone number and links.
import { statSync } from 'node:fs';
import type { PrismaClient } from '../src/generated/prisma/client.ts';
import { toColumns } from '../src/server/content/bilingual.ts';
import {
  aboutPageSchema,
  applicationAreaSchema,
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
  { platform: 'instagram', label: pair('Instagram', 'Instagram'), url: 'https://www.example.com/tanyeri/instagram' },
  { platform: 'linkedin', label: pair('LinkedIn', 'LinkedIn'), url: 'https://www.example.com/tanyeri/linkedin' },
  { platform: 'youtube', label: pair('YouTube', 'YouTube'), url: 'https://www.example.com/tanyeri/youtube' },
].map((link) => socialLinkSchema.parse(link));

const pageMetadata: Record<PageKey, ReturnType<typeof pair>[]> = {
  home: [
    pair('Tanyeri Lighting - Aydınlatma Çözümleri', 'Tanyeri Lighting - Lighting Solutions'),
    pair(
      'Konuttan endüstriyel tesise, enerji verimli ve estetik aydınlatma ürünleri ve uygulamaları. Bu site bir demodur.',
      'Energy-efficient and well-designed lighting products and installations, from homes to industrial sites. This site is a demo.',
    ),
  ],
  products: [
    pair('Ürünler', 'Products'),
    pair(
      'Gömme spot, sarkıt, panel, lineer, ray spot ve dış mekan armatürleri. Örnek ürün listesi.',
      'Recessed spots, pendants, panels, linear, track spots and outdoor luminaires. Sample product list.',
    ),
  ],
  catalogs: [
    pair('Kataloglar', 'Catalogs'),
    pair('Örnek PDF kataloglarını indirin.', 'Download the sample PDF catalogs.'),
  ],
  services: [
    pair('Hizmetler', 'Services'),
    pair(
      'Aydınlatma tasarımı, uygulama, yenileme ve teknik destek hizmetleri.',
      'Lighting design, installation, retrofit and technical support services.',
    ),
  ],
  projects: [
    pair('Projeler', 'Projects'),
    pair(
      'Önce ve sonra görselleriyle tamamlanmış örnek aydınlatma projeleri.',
      'Sample lighting projects with before and after pictures.',
    ),
  ],
  references: [
    pair('Referanslar', 'References'),
    pair('Birlikte çalıştığımız kurumlar (kurgusal isimler).', 'Organisations we work with (fictional names).'),
  ],
  about: [
    pair('Hakkımızda', 'About us'),
    pair(
      'Tanyeri Lighting demo şirketinin hikâyesi, yaklaşımı ve vizyonu.',
      'The story, approach and vision of the Tanyeri Lighting demo company.',
    ),
  ],
  vision: [
    pair('Vizyonumuz', 'Our vision'),
    pair(
      'Tanyeri Lighting demo şirketinin aydınlatma alanındaki hedefleri ve ilkeleri.',
      'The goals and principles of the Tanyeri Lighting demo company in lighting.',
    ),
  ],
  contact: [
    pair('İletişim', 'Contact'),
    pair(
      'Adres, telefon ve e-posta bilgileri ile iletişim formu. Bilgiler kurgusaldır.',
      'Address, phone and email details with a contact form. The details are fictional.',
    ),
  ],
  privacy: [
    pair('Gizlilik Politikası', 'Privacy Policy'),
    pair('Demo sitenin gizlilik politikası örneği.', 'A sample privacy policy for the demo site.'),
  ],
  terms: [
    pair('Kullanım Koşulları', 'Terms of Use'),
    pair('Demo sitenin kullanım koşulları örneği.', 'Sample terms of use for the demo site.'),
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

const categories = [
  ['gomme-spot', 'Gömme Spot', 'Recessed Spots'],
  ['sarkit', 'Sarkıt', 'Pendants'],
  ['panel', 'Panel', 'Panels'],
  ['lineer', 'Lineer', 'Linear'],
  ['ray-spot', 'Ray Spot', 'Track Spots'],
  ['dis-mekan', 'Dış Mekan', 'Outdoor'],
].map(([categoryKey, tr, en]) => categorySchema.parse({ key: categoryKey, name: pair(tr, en) }));

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
  title: pair('Her mekâna doğru ışık', 'The right light for every space'),
  description: pair(
    'Konuttan endüstriyel tesise, enerji verimli ve estetik aydınlatma çözümleri tasarlıyor, üretiyor ve uyguluyoruz.',
    'From homes to industrial sites, we design, make and install energy-efficient, well-designed lighting.',
  ),
  primaryAction: { label: pair('Ürünleri İncele', 'View Products'), target: 'products' },
  secondaryAction: { label: pair('İletişime Geç', 'Get in Touch'), target: 'contact' },
});

const areas = [
  [
    'area-konut.webp',
    'Konut',
    'Homes',
    'Yaşam alanlarına uygun, göz yormayan ve enerji verimli aydınlatma çözümleri.',
    'Comfortable, glare-free and energy-efficient lighting for living spaces.',
  ],
  [
    'area-ofis.webp',
    'Ofis ve Ticari Alanlar',
    'Offices and Commercial Spaces',
    'Verimliliği artıran, mekâna kimlik kazandıran lineer ve panel sistemleri.',
    'Linear and panel systems that raise productivity and give a space its character.',
  ],
  [
    'area-endustriyel.webp',
    'Endüstriyel Tesisler',
    'Industrial Sites',
    'Yüksek tavanlı üretim ve depo alanları için dayanıklı aydınlatma.',
    'Durable lighting for high-ceiling production halls and warehouses.',
  ],
  [
    'area-otel.webp',
    'Otel ve Mağaza',
    'Hotels and Stores',
    'Misafirleri karşılayan, ürünü öne çıkaran sıcak ve dengeli ışık planları.',
    'Warm, balanced lighting plans that welcome guests and show products at their best.',
  ],
  [
    'area-peyzaj.webp',
    'Peyzaj',
    'Landscape',
    'Bahçe, yol ve park aydınlatmasında güvenli ve estetik uygulamalar.',
    'Safe and attractive lighting for gardens, paths and parks.',
  ],
  [
    'area-cephe.webp',
    'Dış Cephe',
    'Facades',
    'Yapının karakterini gece de koruyan cephe ve giriş aydınlatması.',
    'Facade and entrance lighting that keeps the character of a building at night.',
  ],
] as const;

const services = [
  {
    imageUrl: img('service-tasarim.webp'),
    title: pair('Aydınlatma Tasarımı', 'Lighting Design'),
    description: pair(
      'Mekânı ve kullanımı inceleyip **ışık planını** çiziyoruz.\n\n- Aydınlık düzeyi hesabı\n- Armatür seçimi ve yerleşimi\n- Kontrol ve dimleme önerisi',
      'We study the space and how it is used, then draw the **lighting plan**.\n\n- Illuminance calculation\n- Luminaire choice and layout\n- Control and dimming proposal',
    ),
    note: pair('İlk keşif görüşmesi ücretsizdir (demo).', 'The first survey visit is free (demo).'),
  },
  {
    imageUrl: img('service-uygulama.webp'),
    title: pair('Proje ve Uygulama', 'Installation'),
    description: pair(
      'Onaylanan planı **anahtar teslim** uyguluyoruz.\n\n- Montaj ve kablolama\n- Devreye alma ve ayar\n- Teslim sonrası ölçüm',
      'We install the approved plan **turnkey**.\n\n- Fitting and wiring\n- Commissioning and adjustment\n- Measurements after handover',
    ),
    note: pair('', ''),
  },
  {
    imageUrl: img('service-yenileme.webp'),
    title: pair('Yenileme ve Verimlilik', 'Retrofit and Efficiency'),
    description: pair(
      'Eski armatürleri **LED** ile değiştirerek enerji tüketimini düşürüyoruz.\n\n- Mevcut durum analizi\n- Tasarruf tahmini\n- Aşamalı geçiş planı',
      'We replace old luminaires with **LED** to cut energy use.\n\n- Analysis of the current state\n- Savings estimate\n- Phased changeover plan',
    ),
    note: pair('', ''),
  },
  {
    imageUrl: img('area-ofis.webp'),
    title: pair('Danışmanlık ve Bakım', 'Consulting and Maintenance'),
    description: pair(
      'Tamamlanan işler için **bakım ve teknik destek** veriyoruz.\n\n- Periyodik kontrol\n- Yedek parça ve sürücü değişimi\n- Telefonla destek',
      'We give **maintenance and technical support** for finished work.\n\n- Periodic checks\n- Spare parts and driver replacement\n- Support by phone',
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
      'Müstakil bir evin cephesi, girişi ve bahçe yolu yeniden aydınlatıldı.\n\n- **Cephe:** sıcak beyaz duvar yıkama\n- **Yol:** düşük seviyeli bollard armatürler',
      'The facade, entrance and garden path of a detached house were relit.\n\n- **Facade:** warm white wall washing\n- **Path:** low-level bollard luminaires',
    ),
  },
  {
    files: 'project-otel',
    title: pair('Otel Lobisi Yenileme', 'Hotel Lobby Refit'),
    description: pair(
      'Lobi tavanındaki eski armatürler **LED** ile değiştirildi ve tavan hattına gizli ışık eklendi.\n\n- Enerji tüketimi yarıya indi (örnek değer)\n- Daha sıcak ve dengeli ışık',
      'The old ceiling luminaires of the lobby were replaced with **LED** and a hidden light line was added.\n\n- Energy use fell by half (sample figure)\n- Warmer, more even light',
    ),
  },
  {
    files: 'project-fabrika',
    title: pair('Üretim Salonu Aydınlatması', 'Production Hall Lighting'),
    description: pair(
      'Yüksek tavanlı üretim salonuna **yüksek verimli** armatürler yerleştirildi.\n\n- Çalışma düzleminde eşit aydınlık\n- Daha az bakım gerektiren sürücüler',
      'Highly efficient luminaires were fitted in a high-ceiling production hall.\n\n- Even light on the work plane\n- Drivers that need less maintenance',
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
    name: 'Örnek Otel İşletmeleri',
    title: pair('Otel aydınlatması', 'Hotel lighting'),
    description: pair(
      'Lobi ve koridorlar için dekoratif ve genel aydınlatma.',
      'Decorative and general lighting for lobbies and corridors.',
    ),
  },
  {
    imageUrl: img('area-konut.webp'),
    name: 'Demo Konut Yapı',
    title: pair('Konut projesi', 'Housing project'),
    description: pair(
      'Yaşam alanları için panel ve gömme spot çözümleri.',
      'Panel and recessed spot solutions for living spaces.',
    ),
  },
  {
    imageUrl: img('area-ofis.webp'),
    name: 'Lorem Plaza',
    title: pair('Ofis binası', 'Office building'),
    description: pair(
      'Açık ofis katları için lineer aydınlatma sistemi.',
      'A linear lighting system for open-plan office floors.',
    ),
  },
  {
    imageUrl: img('area-endustriyel.webp'),
    name: 'Example Lojistik',
    title: pair('Depo ve lojistik', 'Warehouse and logistics'),
    description: pair(
      'Yüksek tavanlı depo için endüstriyel armatürler.',
      'Industrial luminaires for a high-bay warehouse.',
    ),
  },
  {
    imageUrl: img('area-peyzaj.webp'),
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
      sizeBytes: pdfSize(`${catalog.file}.pdf`),
    }),
  );
  const areaRows = areas.map(([file, tr, en, descriptionTr, descriptionEn]) =>
    applicationAreaSchema.parse({
      imageUrl: img(file),
      title: pair(tr, en),
      description: pair(descriptionTr, descriptionEn),
    }),
  );

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

      const productIds = new Map<string, string>();
      let productCount = 0;
      for (const [categoryPosition, category] of categories.entries()) {
        const row = await tx.category.create({
          data: { key: category.key, ...toColumns('name', category.name), sortOrder: categoryPosition },
        });
        const group = productRows[category.key];
        if (!group) throw new Error(`No products for the category ${category.key}`);
        for (const [position, [slug, tr, en, power, dimensions, image, color]] of group.rows.entries()) {
          const product = productSchema.parse({
            categoryId: row.id,
            slug,
            code: `TL-${group.code}-${String(position + 1).padStart(3, '0')}`,
            name: pair(tr, en),
            color: colors[color],
            material: materials[group.material],
            power,
            dimensions,
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
          title: board.title,
          subtitle: board.subtitle,
          catalogId,
        });
        await tx.promoBoard.create({
          data: {
            imageUrl: parsed.imageUrl,
            ...toColumns('title', parsed.title),
            ...toColumns('subtitle', parsed.subtitle),
            catalogId,
            sortOrder,
          },
        });
      }

      const bannerData = {
        imageUrl: homeBanner.imageUrl,
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
          ...toColumns('title', area.title),
          ...toColumns('description', area.description),
          sortOrder,
        })),
      });

      await tx.service.createMany({
        data: services.map((service, sortOrder) => ({
          imageUrl: service.imageUrl,
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
          name: reference.name,
          ...toColumns('title', reference.title),
          ...toColumns('description', reference.description),
          sortOrder,
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
      };
    },
    { timeout: 60_000 },
  );
}
