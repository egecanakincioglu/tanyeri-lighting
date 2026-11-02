import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SiteSettings, SocialLink } from '../server/content/schemas.ts';
import {
  breadcrumbData,
  contactPageData,
  organizationData,
  organizationId,
  serializeJsonLd,
  websiteData,
} from './structured-data.ts';

const pair = (tr: string, en: string) => ({ tr, en });

const settings: SiteSettings = {
  siteName: pair('Tanyeri Aydınlatma', 'Tanyeri Lighting'),
  logoUrl: '/demo/logo.svg',
  phone: '+90 212 000 00 00',
  email: 'info@example.test',
  address: pair('Adres', 'Address'),
  workingHours: pair('Pzt-Cum 09-18', 'Mon-Fri 9-6'),
  serviceArea: pair('Türkiye', 'Turkey'),
  languages: pair('Türkçe, İngilizce', 'Turkish, English'),
};
const links: SocialLink[] = [
  { id: 'l1', platform: 'instagram', label: pair('Instagram', 'Instagram'), url: 'https://instagram.example/tanyeri' },
];

describe('structured data', () => {
  beforeEach(() => {
    vi.stubEnv('SITE_URL', 'https://example.test');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('serializeJsonLd', () => {
    it('escapes every < so the text can not close or open an element', () => {
      const text = serializeJsonLd({ name: '</script><script>alert(1)</script>', note: '<!--' });
      expect(text).not.toContain('<');
      expect(text).toContain('\\u003c/script>');
    });

    it('reads back to the same value', () => {
      const data = { name: '</script><script>x</script>', n: 1, nested: { list: ['<b>'] } };
      expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
    });
  });

  describe('websiteData', () => {
    it.each([
      ['tr', 'Tanyeri Aydınlatma', 'https://example.test/tr'],
      ['en', 'Tanyeri Lighting', 'https://example.test/en'],
    ] as const)('names the site and its address in %s', (locale, name, url) => {
      expect(websiteData(settings, locale)).toEqual({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        '@id': 'https://example.test/#website',
        url,
        name,
        inLanguage: locale,
        publisher: { '@id': organizationId() },
      });
    });

    it('falls back to the brand name before the settings are saved', () => {
      expect(websiteData({ ...settings, siteName: pair('', '') }, 'en').name).toBe('Tanyeri Lighting');
    });
  });

  describe('organizationData', () => {
    it('carries the name, logo, social links and contact point from the settings', () => {
      expect(organizationData(settings, links, 'en')).toEqual({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        '@id': 'https://example.test/#organization',
        name: 'Tanyeri Lighting',
        url: 'https://example.test/en',
        logo: 'https://example.test/demo/logo.svg',
        sameAs: ['https://instagram.example/tanyeri'],
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer service',
          email: 'info@example.test',
          telephone: '+90 212 000 00 00',
          areaServed: 'Turkey',
          availableLanguage: 'Turkish, English',
        },
      });
    });

    it('never writes a postal address or a business type', () => {
      const text = JSON.stringify(organizationData(settings, links, 'tr'));
      expect(text).not.toContain('address');
      expect(text).not.toContain('LocalBusiness');
    });

    it('leaves out what is empty', () => {
      const empty: SiteSettings = {
        ...settings,
        logoUrl: null,
        phone: '',
        email: '',
        serviceArea: pair('', ''),
        languages: pair('', ''),
      };
      const data = organizationData(empty, [], 'tr');
      expect(data).not.toHaveProperty('logo');
      expect(data).not.toHaveProperty('sameAs');
      expect(data).not.toHaveProperty('contactPoint');
      expect(data).not.toHaveProperty('description');
    });

    it('keeps only the filled contact fields', () => {
      const data = organizationData({ ...settings, phone: '', serviceArea: pair('', '') }, [], 'tr');
      expect(data.contactPoint).toEqual({
        '@type': 'ContactPoint',
        contactType: 'customer service',
        email: 'info@example.test',
        availableLanguage: 'Türkçe, İngilizce',
      });
    });

    it('repeats the visible demo notice as the description', () => {
      const notice = 'Fictional brand: this is a demo site and nothing is for sale.';
      expect(organizationData(settings, [], 'en', notice).description).toBe(notice);
    });

    it('keeps text with markup inside the data, escaped only when written', () => {
      const data = organizationData({ ...settings, siteName: pair('</script>', '</script>') }, [], 'en');
      expect(data.name).toBe('</script>');
      expect(serializeJsonLd(data)).not.toContain('</script>');
    });
  });

  describe('breadcrumbData', () => {
    it('lists the trail with positions and absolute addresses in the page language', () => {
      expect(
        breadcrumbData('tr', [
          { name: 'Ana sayfa', href: '/' },
          { name: 'Ürünler', href: '/products' },
          { name: 'Spot', href: { pathname: '/products/[slug]', params: { slug: 'spot' } } },
        ]),
      ).toEqual({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Ana sayfa', item: 'https://example.test/tr' },
          { '@type': 'ListItem', position: 2, name: 'Ürünler', item: 'https://example.test/tr/urunler' },
          { '@type': 'ListItem', position: 3, name: 'Spot', item: 'https://example.test/tr/urunler/spot' },
        ],
      });
    });
  });

  describe('contactPageData', () => {
    it('describes the page and refers to the organization by id', () => {
      expect(contactPageData('Contact', 'en')).toEqual({
        '@context': 'https://schema.org',
        '@type': 'ContactPage',
        '@id': 'https://example.test/en/contact',
        url: 'https://example.test/en/contact',
        name: 'Contact',
        inLanguage: 'en',
        about: { '@id': 'https://example.test/#organization' },
      });
    });
  });
});
