import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider, createTranslator } from 'next-intl';
import { axeViolations } from '../../../test/axe.ts';
import { optimizedSource } from '../../../test/optimized-source.ts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../messages/en.json' with { type: 'json' };
import tr from '../../../../messages/tr.json' with { type: 'json' };
import SiteLayout from './layout.tsx';

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/tr',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ locale: 'tr' }),
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale, namespace }: { locale: 'tr' | 'en'; namespace: 'Header' | 'DemoBand' }) =>
    createTranslator({ locale, messages: locale === 'tr' ? tr : en, namespace }),
}));
vi.mock('../../../components/site/footer.tsx', () => ({
  Footer: ({ settings }: { settings: { logoUrl: string | null } }) => (
    <footer data-logo={settings.logoUrl}>footer</footer>
  ),
}));
const mocks = vi.hoisted(() => ({ getSiteSettings: vi.fn(), listCategories: vi.fn() }));
vi.mock('../../../server/content/categories.ts', () => ({ listCategories: mocks.listCategories }));
vi.mock('../../../server/content/site-settings.ts', () => ({ getSiteSettings: mocks.getSiteSettings }));

describe('SiteLayout', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'sendBeacon', { value: vi.fn(), configurable: true });
    mocks.getSiteSettings.mockClear();
    mocks.getSiteSettings.mockResolvedValue({ logoUrl: null });
    mocks.listCategories.mockClear();
    mocks.listCategories.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it.each([
    ['tr', tr, 'İçeriğe geç'],
    ['en', en, 'Skip to content'],
  ] as const)(
    'wraps the page with a skip link, the header, one main landmark and the footer in %s',
    async (locale, messages, skip) => {
      const layout = await SiteLayout({
        children: <p>page</p>,
        params: Promise.resolve({ locale }),
      } as Parameters<typeof SiteLayout>[0]);
      render(
        <NextIntlClientProvider locale={locale} messages={messages}>
          {layout}
        </NextIntlClientProvider>,
      );

      const skipLink = screen.getByRole('link', { name: skip });
      expect(skipLink.getAttribute('href')).toBe('#main');
      expect(screen.getAllByRole('main')).toHaveLength(1);
      expect(screen.getByRole('main').id).toBe('main');
      expect(screen.getByRole('main').textContent).toBe('page');
      expect(screen.getByRole('banner')).toBeTruthy();
      expect(screen.getByRole('contentinfo')).toBeTruthy();
      const order = [skipLink, screen.getByRole('banner'), screen.getByRole('main'), screen.getByRole('contentinfo')];
      for (const [index, element] of order.entries()) {
        const next = order[index + 1];
        if (next) expect(element.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
    },
  );
  it.each([
    ['tr', tr, '/tr/urunler?category=sarkit', 'Sarkıt'],
    ['en', en, '/en/products?category=sarkit', 'Pendants'],
  ] as const)('lists the categories under Products in the header in %s', async (locale, messages, href, name) => {
    mocks.listCategories.mockResolvedValue([{ id: 'c1', key: 'sarkit', name: { tr: 'Sarkıt', en: 'Pendants' } }]);
    const layout = await SiteLayout({
      children: <p>page</p>,
      params: Promise.resolve({ locale }),
    } as Parameters<typeof SiteLayout>[0]);
    render(
      <NextIntlClientProvider locale={locale} messages={messages}>
        {layout}
      </NextIntlClientProvider>,
    );
    const links = screen.getAllByRole('link', { name, hidden: true });
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((link) => link.getAttribute('href') === href)).toBe(true);
  });

  it('reads the settings once and gives the logo to the header and the footer', async () => {
    mocks.getSiteSettings.mockResolvedValue({ logoUrl: '/demo/area-otel.webp' });
    const layout = await SiteLayout({
      children: <p>page</p>,
      params: Promise.resolve({ locale: 'en' }),
    } as Parameters<typeof SiteLayout>[0]);
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        {layout}
      </NextIntlClientProvider>,
    );
    expect(mocks.getSiteSettings).toHaveBeenCalledTimes(1);
    expect(optimizedSource(screen.getAllByRole('img', { name: 'Tanyeri Lighting' })[0]!)).toBe('/demo/area-otel.webp');
    expect(screen.getByRole('contentinfo').getAttribute('data-logo')).toBe('/demo/area-otel.webp');
  });

  it('counts the page view with the beacon', async () => {
    const layout = await SiteLayout({
      children: <p>page</p>,
      params: Promise.resolve({ locale: 'tr' }),
    } as Parameters<typeof SiteLayout>[0]);
    render(
      <NextIntlClientProvider locale="tr" messages={tr}>
        {layout}
      </NextIntlClientProvider>,
    );
    expect(navigator.sendBeacon).toHaveBeenCalledWith('/api/visits', '/tr');
  });

  it.each([
    ['tr', tr, 'Kurgusal marka: bu bir demo sitedir, hiçbir ürün satışta değildir.'],
    ['en', en, 'Fictional brand: this is a demo site and nothing is for sale.'],
  ] as const)(
    'shows the demo notice above the header in demo mode in %s, and axe passes',
    async (locale, messages, text) => {
      vi.stubEnv('DEMO_MODE', 'true');
      const layout = await SiteLayout({
        children: <p>page</p>,
        params: Promise.resolve({ locale }),
      } as Parameters<typeof SiteLayout>[0]);
      const { container } = render(
        <NextIntlClientProvider locale={locale} messages={messages}>
          {layout}
        </NextIntlClientProvider>,
      );

      const notice = screen.getByRole('complementary');
      expect(notice.textContent).toBe(text);
      expect(
        notice.compareDocumentPosition(screen.getByRole('banner')) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(screen.queryAllByRole('heading')).toHaveLength(0);
      expect(await axeViolations(container)).toEqual([]);
    },
  );

  it('shows no demo notice when demo mode is off', async () => {
    vi.stubEnv('DEMO_MODE', 'false');
    const layout = await SiteLayout({
      children: <p>page</p>,
      params: Promise.resolve({ locale: 'en' }),
    } as Parameters<typeof SiteLayout>[0]);
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        {layout}
      </NextIntlClientProvider>,
    );

    expect(screen.queryByRole('complementary')).toBeNull();
  });
});
