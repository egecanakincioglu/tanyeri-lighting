import { routing } from '../../i18n/routing.ts';
import { absoluteUrl, localizedPath, type Locale, type PageHref } from '../../lib/seo.ts';

const PAGES: { href: PageHref; name: Record<Locale, string> }[] = [
  { href: '/', name: { tr: 'Ana sayfa', en: 'Home' } },
  { href: '/products', name: { tr: 'Ürünler', en: 'Products' } },
  { href: '/catalogs', name: { tr: 'Kataloglar', en: 'Catalogs' } },
  { href: '/services', name: { tr: 'Hizmetler', en: 'Services' } },
  { href: '/projects', name: { tr: 'Projeler', en: 'Projects' } },
  { href: '/references', name: { tr: 'Referanslar', en: 'References' } },
  { href: '/about', name: { tr: 'Hakkımızda', en: 'About' } },
  { href: '/contact', name: { tr: 'İletişim', en: 'Contact' } },
];

const SECTIONS: Record<Locale, string> = { tr: 'Türkçe', en: 'English' };

// A plain-text map of the public pages for readers that prefer Markdown. Google Search does not use this file; it
// answers the Lighthouse audit and gives text-only readers a short overview. The links follow SITE_URL.
export function GET(): Response {
  const lines = [
    '# Tanyeri Lighting',
    '',
    '> Tanyeri Lighting is a fictional demo brand of LED and architectural lighting, built to show a complete company website. It is not a real company: the products, projects and contact details are examples.',
    '',
  ];
  for (const locale of routing.locales) {
    lines.push(`## ${SECTIONS[locale]}`, '');
    for (const { href, name } of PAGES) {
      lines.push(`- [${name[locale]}](${absoluteUrl(localizedPath(locale, href))})`);
    }
    lines.push('');
  }
  return new Response(lines.join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
