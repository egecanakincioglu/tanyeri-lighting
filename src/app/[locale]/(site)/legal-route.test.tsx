import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderLegalPage } from './legal-route.tsx';

const content = vi.hoisted(() => ({ legal: vi.fn() }));

vi.mock('../../../server/content/legal-pages.ts', () => ({ getLegalPage: content.legal }));
vi.mock('../../../server/content/page-metadata.ts', () => ({ getPageMetadata: async () => null }));
// The real helper needs the Next.js server runtime.
vi.mock('next-intl/server', () => ({
  getTranslations: ({ locale }: { locale: 'tr' | 'en' }) =>
    Promise.resolve(() => (locale === 'tr' ? 'Ana sayfa' : 'Home')),
}));

describe('renderLegalPage', () => {
  beforeEach(() => {
    vi.stubEnv('SITE_URL', 'https://example.test');
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    content.legal.mockReset();
  });

  it.each([
    ['privacy', 'en', 'Privacy Policy', 'https://example.test/en/privacy'],
    ['terms', 'tr', 'Kullanım Koşulları', 'https://example.test/tr/kullanim-kosullari'],
  ] as const)('writes the %s trail with the page title in %s', async (key, locale, title, url) => {
    content.legal.mockResolvedValue({
      title: { tr: 'Kullanım Koşulları', en: 'Privacy Policy' },
      body: { tr: 'Metin', en: 'Text' },
      updatedAt: new Date(),
    });
    const { container } = render(await renderLegalPage(key, locale));
    const data = JSON.parse(container.querySelector('script[type="application/ld+json"]')?.textContent ?? '');
    expect(data.itemListElement.at(-1)).toMatchObject({ position: 2, name: title, item: url });
  });

  it('answers 404 for a page that was never saved', async () => {
    content.legal.mockResolvedValue(null);
    await expect(renderLegalPage('privacy', 'en')).rejects.toMatchObject({ digest: expect.stringContaining('404') });
  });
});
