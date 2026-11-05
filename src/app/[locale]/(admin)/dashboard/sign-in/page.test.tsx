import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../messages/en.json' with { type: 'json' };
import tr from '../../../../../../messages/tr.json' with { type: 'json' };
import { axeViolations } from '../../../../../test/axe.ts';
import SignInPage, { generateMetadata } from './page.tsx';

const auth = vi.hoisted(() => ({ currentSession: vi.fn() }));

vi.mock('../../../../../server/auth/guard.ts', () => ({ currentSession: auth.currentSession }));
vi.mock('../../../../../server/auth/sign-in-action.ts', () => ({ signInAction: vi.fn() }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  redirect: (target: string) => {
    throw new Error(`redirect:${target}`);
  },
  notFound: () => {
    throw new Error('not-found');
  },
}));

// The real helper needs the Next.js server runtime.
vi.mock('next-intl/server', () => ({
  getTranslations: ({ locale, namespace }: { locale: 'tr' | 'en'; namespace: 'Admin' }) => {
    const messages = { tr, en }[locale][namespace] as Record<string, string>;
    return Promise.resolve((key: string) => messages[key] ?? '');
  },
}));

const props = (locale: string) => ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/dashboard/sign-in'>;

async function renderPage(locale: 'tr' | 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {await SignInPage(props(locale))}
    </NextIntlClientProvider>,
  );
}

describe('SignInPage', () => {
  beforeEach(() => auth.currentSession.mockResolvedValue(null));
  afterEach(cleanup);

  it('shows the form, the reset note and a way back to the site in English', async () => {
    await renderPage('en');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Administrator sign-in');
    expect(screen.getByLabelText('E-mail')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Forgot your password?');
    expect(screen.getByRole('link', { name: 'Back to the site' }).getAttribute('href')).toBe('/en');
  });

  it('shows the Turkish texts', async () => {
    await renderPage('tr');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Yönetici girişi');
    expect(screen.getByRole('button', { name: 'Giriş yap' })).toBeTruthy();
  });

  it('sends a signed-in visitor to the panel of the language', async () => {
    auth.currentSession.mockResolvedValue({ user: { email: 'admin@example.com' } });
    await expect(SignInPage(props('en'))).rejects.toThrow('redirect:/en/admin');
    await expect(SignInPage(props('tr'))).rejects.toThrow('redirect:/tr/yonetim');
  });

  describe('demo account', () => {
    const SECRET = 'x'.repeat(32);

    beforeEach(() => {
      vi.stubEnv('DEMO_ADMIN_EMAIL', 'demo@example.com');
      vi.stubEnv('DEMO_ADMIN_PASSWORD', SECRET);
    });
    afterEach(() => vi.unstubAllEnvs());

    it('shows the account in demo mode when both values are set', async () => {
      vi.stubEnv('DEMO_MODE', 'true');
      await renderPage('en');
      expect(screen.getByRole('heading', { name: 'Demo account' })).toBeTruthy();
      expect(screen.getByText('demo@example.com')).toBeTruthy();
      expect(screen.getByText(SECRET)).toBeTruthy();
    });

    it('shows it in Turkish', async () => {
      vi.stubEnv('DEMO_MODE', 'true');
      await renderPage('tr');
      expect(screen.getByRole('heading', { name: 'Demo hesabı' })).toBeTruthy();
    });

    it('never shows the values outside demo mode', async () => {
      vi.stubEnv('DEMO_MODE', 'false');
      const { container } = await renderPage('en');
      expect(container.textContent).not.toContain(SECRET);
      expect(container.textContent).not.toContain('demo@example.com');
    });

    it('shows no section in demo mode when the values are not set', async () => {
      vi.stubEnv('DEMO_MODE', 'true');
      vi.stubEnv('DEMO_ADMIN_EMAIL', '');
      vi.stubEnv('DEMO_ADMIN_PASSWORD', '');
      await renderPage('en');
      expect(screen.queryByRole('heading', { name: 'Demo account' })).toBeNull();
    });

    it('has no axe violations with the account shown', async () => {
      vi.stubEnv('DEMO_MODE', 'true');
      const { container } = await renderPage('en');
      expect(await axeViolations(container)).toEqual([]);
    });
  });

  describe('forgot password link', () => {
    const SMTP = {
      SMTP_HOST: 'mail.example.com',
      SMTP_PORT: '587',
      SMTP_USER: 'sender',
      SMTP_PASSWORD: 'x'.repeat(12),
      SMTP_FROM: 'noreply@example.com',
    };
    afterEach(() => vi.unstubAllEnvs());

    function stub(values: Record<string, string>) {
      for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value);
    }

    it('links to the request page when e-mail is set up and the demo is off', async () => {
      stub({ ...SMTP, DEMO_MODE: 'false' });
      await renderPage('en');
      expect(screen.getByRole('link', { name: 'Reset it by e-mail' }).getAttribute('href')).toBe(
        '/en/admin/forgot-password',
      );
      expect(screen.queryByText(/with a command on the server/)).toBeNull();
    });

    it('links in Turkish to the Turkish address', async () => {
      stub({ ...SMTP, DEMO_MODE: 'false' });
      await renderPage('tr');
      expect(screen.getByRole('link', { name: 'E-posta ile sıfırlayın' }).getAttribute('href')).toBe(
        '/tr/yonetim/parola-unuttum',
      );
    });

    it('shows the note and no link without e-mail', async () => {
      stub({ SMTP_HOST: '', SMTP_PORT: '', SMTP_USER: '', SMTP_PASSWORD: '', SMTP_FROM: '', DEMO_MODE: 'false' });
      await renderPage('en');
      expect(screen.queryByRole('link', { name: 'Reset it by e-mail' })).toBeNull();
      expect(screen.getByText(/with a command on the server/)).toBeTruthy();
    });

    it('shows the note and no link in demo mode', async () => {
      stub({ ...SMTP, DEMO_MODE: 'true' });
      await renderPage('en');
      expect(screen.queryByRole('link', { name: 'Reset it by e-mail' })).toBeNull();
      expect(screen.getByText(/with a command on the server/)).toBeTruthy();
    });
  });

  it('answers an unknown language with not found', async () => {
    await expect(SignInPage(props('xx'))).rejects.toThrow('not-found');
  });

  it('is kept out of search results', async () => {
    expect(await generateMetadata(props('en'))).toMatchObject({ robots: { index: false, follow: false } });
  });

  it('has no axe violations', async () => {
    const { container } = await renderPage('en');
    expect(await axeViolations(container)).toEqual([]);
  });
});
