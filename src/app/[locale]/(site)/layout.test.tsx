import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider, createTranslator } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../messages/en.json' with { type: 'json' };
import tr from '../../../../messages/tr.json' with { type: 'json' };
import SiteLayout from './layout.tsx';

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/tr',
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale, namespace }: { locale: 'tr' | 'en'; namespace: 'Header' }) =>
    createTranslator({ locale, messages: locale === 'tr' ? tr : en, namespace }),
}));
// The footer reads the database; its own tests cover it.
vi.mock('../../../components/site/footer.tsx', () => ({ Footer: () => <footer>footer</footer> }));

describe('SiteLayout', () => {
  afterEach(cleanup);

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
});
