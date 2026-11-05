import { cleanup, render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../messages/en.json' with { type: 'json' };
import tr from '../../../../../messages/tr.json' with { type: 'json' };
import type { SiteSettings } from '../../../../server/content/schemas.ts';
import ContactPage, { generateMetadata } from './page.tsx';

const content = vi.hoisted(() => ({ settings: vi.fn(), metadata: vi.fn(), enquiry: vi.fn() }));

vi.mock('../../../../server/content/site-settings.ts', () => ({ getSiteSettings: content.settings }));
vi.mock('../../../../server/content/page-metadata.ts', () => ({ getPageMetadata: content.metadata }));
vi.mock('../../../../server/contact/product-enquiry.ts', () => ({ findEnquiryProduct: content.enquiry }));
vi.mock('../../../../server/contact/actions.ts', () => ({ submitContactMessage: async () => ({ status: 'ok' }) }));
// The real helper needs the Next.js server runtime.
vi.mock('next-intl/server', () => ({
  getTranslations: ({ locale, namespace }: { locale: 'tr' | 'en'; namespace: 'Header' }) =>
    Promise.resolve((key: string) => (({ tr, en })[locale][namespace] as Record<string, string>)[key]),
}));

const pair = (text: string) => ({ tr: `${text} TR`, en: `${text} EN` });
const settings: SiteSettings = {
  siteName: pair('Brand'),
  logoUrl: null,
  phone: '+90 212 000 00 00',
  email: 'info@example.test',
  address: pair('Address'),
  workingHours: pair('Hours'),
  serviceArea: pair('Area'),
  languages: pair('Languages'),
};

const props = (locale: string) =>
  ({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) }) as PageProps<'/[locale]/contact'>;

describe('ContactPage', () => {
  beforeEach(() => {
    vi.stubEnv('SITE_URL', 'https://example.test');
    content.settings.mockResolvedValue(settings);
    content.metadata.mockResolvedValue(null);
    content.enquiry.mockResolvedValue(null);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    content.settings.mockClear();
    content.metadata.mockClear();
    content.enquiry.mockClear();
  });

  it.each([
    ['tr', 'İletişim', 'https://example.test/tr/iletisim', tr],
    ['en', 'Contact', 'https://example.test/en/contact', en],
  ] as const)(
    'describes the contact page and its trail as structured data in %s',
    async (locale, name, url, messages) => {
      const { container } = render(
        <NextIntlClientProvider locale={locale} messages={messages}>
          {await ContactPage(props(locale))}
        </NextIntlClientProvider>,
      );
      const [contact, trail] = [...container.querySelectorAll('script[type="application/ld+json"]')].map((script) =>
        JSON.parse(script.textContent ?? ''),
      );
      expect(contact).toMatchObject({
        '@type': 'ContactPage',
        '@id': url,
        url,
        name,
        about: { '@id': 'https://example.test/#organization' },
      });
      expect(trail['@type']).toBe('BreadcrumbList');
      expect(trail.itemListElement.at(-1)).toMatchObject({ name, item: url });
    },
  );

  it.each([
    ['tr', '/tr/iletisim'],
    ['en', '/en/contact'],
  ] as const)('sets the canonical in %s and keeps the saved description', async (locale, canonical) => {
    content.metadata.mockResolvedValue({
      title: pair('T'),
      description: pair('Description'),
      updatedAt: new Date(),
    });
    const metadata = await generateMetadata(props(locale));
    expect(metadata.description).toBe(`Description ${locale.toUpperCase()}`);
    expect(metadata.alternates).toEqual({
      canonical,
      languages: { tr: '/tr/iletisim', en: '/en/contact', 'x-default': '/tr/iletisim' },
    });
  });
});
