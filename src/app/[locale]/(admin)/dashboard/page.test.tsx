import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../messages/en.json' with { type: 'json' };
import tr from '../../../../../messages/tr.json' with { type: 'json' };
import { axeViolations } from '../../../../test/axe.ts';
import PanelPage, { generateMetadata } from './page.tsx';

const auth = vi.hoisted(() => ({ guardPage: vi.fn() }));

vi.mock('../../../../server/auth/guard.ts', () => ({ guardPage: auth.guardPage }));
vi.mock('../../../../server/auth/sign-out-action.ts', () => ({ signOutAction: vi.fn() }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('not-found');
  },
}));

// The real helper needs the Next.js server runtime; this fake reads the same message files and fills `{email}`.
vi.mock('next-intl/server', () => ({
  getTranslations: ({ locale, namespace }: { locale: 'tr' | 'en'; namespace: 'Admin' }) => {
    const messages = { tr, en }[locale][namespace] as Record<string, string>;
    return Promise.resolve((key: string, values: Record<string, string> = {}) =>
      Object.entries(values).reduce((text, [name, value]) => text.replace(`{${name}}`, value), messages[key] ?? ''),
    );
  },
}));

const props = (locale: string) => ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/dashboard'>;

async function renderPage(locale: 'tr' | 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {await PanelPage(props(locale))}
    </NextIntlClientProvider>,
  );
}

describe('PanelPage', () => {
  beforeEach(() => {
    auth.guardPage.mockClear();
    auth.guardPage.mockResolvedValue({ user: { email: 'admin@example.com' } });
  });
  afterEach(cleanup);

  it('shows the title, the signed-in address, a note and a sign-out button in English', async () => {
    await renderPage('en');
    expect(auth.guardPage).toHaveBeenCalledWith('en');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Admin panel');
    expect(screen.getByText('Signed in as admin@example.com')).toBeTruthy();
    expect(screen.getByText('Content management comes next.')).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Sign out' }) as HTMLButtonElement;
    expect(button.type).toBe('submit');
    expect(button.closest('form')).not.toBeNull();
  });

  it('shows the Turkish texts and asks the guard for the Turkish locale', async () => {
    await renderPage('tr');
    expect(auth.guardPage).toHaveBeenCalledWith('tr');
    expect(screen.getByText('admin@example.com olarak giriş yapıldı')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Çıkış yap' })).toBeTruthy();
  });

  it('shows nothing to a visitor without a session: the guard redirects', async () => {
    auth.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
    await expect(PanelPage(props('en'))).rejects.toThrow('redirect:/en/admin/sign-in');
  });

  it('answers an unknown language with not found before any session lookup', async () => {
    await expect(PanelPage(props('xx'))).rejects.toThrow('not-found');
    expect(auth.guardPage).not.toHaveBeenCalled();
  });

  it('is kept out of search results', async () => {
    expect(await generateMetadata(props('tr'))).toMatchObject({ robots: { index: false, follow: false } });
  });

  it('has no axe violations', async () => {
    const { container } = await renderPage('en');
    expect(await axeViolations(container)).toEqual([]);
  });
});
