import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../messages/en.json' with { type: 'json' };
import tr from '../../../../../../messages/tr.json' with { type: 'json' };
import { axeViolations } from '../../../../../test/axe.ts';
import ResetPasswordPage, { generateMetadata } from './page.tsx';

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('not-found');
  },
}));

// The real helper needs the Next.js server runtime; this fake reads the same message files, nested keys included.
vi.mock('next-intl/server', () => ({
  getTranslations: ({ locale, namespace }: { locale: 'tr' | 'en'; namespace: 'Admin' | 'AdminReset' }) => {
    const messages = { tr, en }[locale][namespace] as Record<string, unknown>;
    return Promise.resolve((key: string) =>
      String(
        key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages),
      ),
    );
  },
}));

const SMTP = {
  SMTP_HOST: 'mail.example.com',
  SMTP_PORT: '587',
  SMTP_USER: 'sender',
  SMTP_PASSWORD: 'x'.repeat(12),
  SMTP_FROM: 'noreply@example.com',
};

function stub(values: Record<string, string>) {
  for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value);
}

const props = (locale: string, token?: string | string[]) =>
  ({
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve(token === undefined ? {} : { token }),
  }) as PageProps<'/[locale]/dashboard/reset-password'>;

async function renderPage(locale: 'tr' | 'en', token?: string | string[]) {
  return render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {await ResetPasswordPage(props(locale, token))}
    </NextIntlClientProvider>,
  );
}

describe('ResetPasswordPage', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('shows the new password form when the link has a key', async () => {
    stub({ ...SMTP, DEMO_MODE: 'false' });
    const { container } = await renderPage('en', 'abc');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Choose a new password');
    expect(screen.getByLabelText('New password')).toBeTruthy();
    expect(screen.getByLabelText('Repeat the new password')).toBeTruthy();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('shows the Turkish texts', async () => {
    stub({ ...SMTP, DEMO_MODE: 'false' });
    await renderPage('tr', 'abc');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Yeni parola belirleyin');
    expect(screen.getByRole('button', { name: 'Parolayı değiştir' })).toBeTruthy();
  });

  it.each([[undefined], [['a', 'b']]])(
    'shows the invalid link state when the key is missing or repeated (%#)',
    async (token) => {
      stub({ ...SMTP, DEMO_MODE: 'false' });
      const { container } = await renderPage('en', token);
      expect(screen.getByRole('heading', { name: 'This link does not work' })).toBeTruthy();
      expect(screen.queryByLabelText('New password')).toBeNull();
      expect(screen.getByRole('link', { name: 'Request a new link' }).getAttribute('href')).toBe(
        '/en/admin/forgot-password',
      );
      expect(await axeViolations(container)).toEqual([]);
    },
  );

  it('says it is not available without e-mail or in demo mode', async () => {
    stub({ SMTP_HOST: '', SMTP_PORT: '', SMTP_USER: '', SMTP_PASSWORD: '', SMTP_FROM: '', DEMO_MODE: 'false' });
    await renderPage('en', 'abc');
    expect(screen.getByRole('heading', { name: 'Reset by e-mail is not available' })).toBeTruthy();
    expect(screen.queryByLabelText('New password')).toBeNull();
    cleanup();
    stub({ ...SMTP, DEMO_MODE: 'true' });
    await renderPage('en', 'abc');
    expect(screen.getByRole('heading', { name: 'Reset by e-mail is not available' })).toBeTruthy();
  });

  it('answers an unknown language with not found', async () => {
    await expect(ResetPasswordPage(props('xx', 'abc'))).rejects.toThrow('not-found');
  });

  it('is kept out of search results', async () => {
    expect(await generateMetadata(props('en'))).toMatchObject({ robots: { index: false, follow: false } });
  });
});
