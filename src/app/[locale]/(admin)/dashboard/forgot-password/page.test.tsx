import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../messages/en.json' with { type: 'json' };
import tr from '../../../../../../messages/tr.json' with { type: 'json' };
import { axeViolations } from '../../../../../test/axe.ts';
import ForgotPasswordPage, { generateMetadata } from './page.tsx';

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

const props = (locale: string) =>
  ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/dashboard/forgot-password'>;

async function renderPage(locale: 'tr' | 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {await ForgotPasswordPage(props(locale))}
    </NextIntlClientProvider>,
  );
}

describe('ForgotPasswordPage', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('shows the request form in English', async () => {
    stub({ ...SMTP, DEMO_MODE: 'false' });
    const { container } = await renderPage('en');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Reset your password');
    expect(screen.getByLabelText('E-mail')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send the reset link' })).toBeTruthy();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('shows the Turkish texts', async () => {
    stub({ ...SMTP, DEMO_MODE: 'false' });
    await renderPage('tr');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Parolanızı sıfırlayın');
    expect(screen.getByRole('button', { name: 'Sıfırlama bağlantısı gönder' })).toBeTruthy();
  });

  it('says reset by e-mail is not available when e-mail is off', async () => {
    stub({ SMTP_HOST: '', SMTP_PORT: '', SMTP_USER: '', SMTP_PASSWORD: '', SMTP_FROM: '', DEMO_MODE: 'false' });
    const { container } = await renderPage('en');
    expect(screen.getByRole('heading', { name: 'Reset by e-mail is not available' })).toBeTruthy();
    expect(screen.queryByLabelText('E-mail')).toBeNull();
    expect(screen.getByRole('link', { name: 'Go to sign-in' })).toBeTruthy();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('says it is not available in demo mode', async () => {
    stub({ ...SMTP, DEMO_MODE: 'true' });
    await renderPage('en');
    expect(screen.getByRole('heading', { name: 'Reset by e-mail is not available' })).toBeTruthy();
    expect(screen.queryByLabelText('E-mail')).toBeNull();
  });

  it('answers an unknown language with not found', async () => {
    await expect(ForgotPasswordPage(props('xx'))).rejects.toThrow('not-found');
  });

  it('is kept out of search results', async () => {
    expect(await generateMetadata(props('en'))).toMatchObject({ robots: { index: false, follow: false } });
  });
});
