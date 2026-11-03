import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../../../../../test/axe.ts';
import BannerAdminPage, { generateMetadata } from './page.tsx';

const mocks = vi.hoisted(() => ({ guardPage: vi.fn(), getHomeBanner: vi.fn() }));

vi.mock('../../../../../../server/auth/guard.ts', () => ({ guardPage: mocks.guardPage }));
vi.mock('../../../../../../server/content/home-banner.ts', () => ({ getHomeBanner: mocks.getHomeBanner }));
vi.mock('../../../../../../server/admin/banner-actions.ts', () => ({ updateBannerAction: vi.fn() }));
vi.mock('../../../../../../server/admin/upload-actions.ts', () => ({ uploadMediaAction: vi.fn() }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('not-found');
  },
}));
vi.mock('next-intl/server', async () => ({
  getTranslations: (await import('../../../../../../test/translations.ts')).getTranslations,
}));

const banner = {
  imageUrl: '/demo/banner.webp',
  imageAlt: { tr: 'Gece evi', en: 'A house at night' },
  title: { tr: 'Başlık', en: 'Banner title' },
  description: { tr: 'Açıklama', en: 'Banner text' },
  primaryAction: { label: { tr: 'Ürünler', en: 'Products' }, target: 'products' },
  secondaryAction: { label: { tr: 'İletişim', en: 'Contact' }, target: 'contact' },
};

const props = (locale: string) => ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/dashboard/banner'>;

const show = async (locale: 'tr' | 'en') =>
  render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {await BannerAdminPage(props(locale))}
    </NextIntlClientProvider>,
  );

describe('banner screen', () => {
  beforeEach(() => {
    mocks.guardPage.mockClear();
    mocks.guardPage.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.getHomeBanner.mockClear();
    mocks.getHomeBanner.mockResolvedValue(banner);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('fills the form with the stored banner, with the pages named in the language of the panel', async () => {
    await show('en');
    expect(mocks.guardPage).toHaveBeenCalledWith('en');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Banner');
    expect((screen.getByLabelText('Turkish', { selector: '#title-tr' }) as HTMLInputElement).value).toBe('Başlık');
    expect((screen.getByLabelText('Turkish', { selector: '#imageAlt-tr' }) as HTMLInputElement).value).toBe('Gece evi');
    const first = screen.getByLabelText('First button opens') as HTMLSelectElement;
    expect(first.value).toBe('products');
    expect([...first.options].map((option) => option.text)).toContain('Privacy Policy');
    expect((screen.getByLabelText('Second button opens') as HTMLSelectElement).value).toBe('contact');
  });

  it('is Turkish at the Turkish address and stays out of search results', async () => {
    await show('tr');
    expect(screen.getByLabelText('Birinci düğme açar')).toBeTruthy();
    expect(await generateMetadata(props('en'))).toMatchObject({ robots: { index: false, follow: false } });
  });

  it('turns saving off in the demo', async () => {
    vi.stubEnv('DEMO_MODE', 'true');
    await show('en');
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('refuses a visitor without a session and an unknown language', async () => {
    mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
    await expect(BannerAdminPage(props('en'))).rejects.toThrow('redirect:');
    expect(mocks.getHomeBanner).not.toHaveBeenCalled();
    await expect(BannerAdminPage(props('xx'))).rejects.toThrow('not-found');
  });

  it('has no axe violations', async () => {
    const { container } = await show('en');
    expect(await axeViolations(container)).toEqual([]);
  });
});
