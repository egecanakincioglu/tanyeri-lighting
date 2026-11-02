import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PanelLayout from './layout.tsx';

const mocks = vi.hoisted(() => ({ guardPage: vi.fn(), countUnreadMessages: vi.fn() }));

vi.mock('../../../../../server/auth/guard.ts', () => ({ guardPage: mocks.guardPage }));
vi.mock('../../../../../server/admin/counts.ts', () => ({ countUnreadMessages: mocks.countUnreadMessages }));
vi.mock('../../../../../server/auth/sign-out-action.ts', () => ({ signOutAction: vi.fn() }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/en/admin',
  notFound: () => {
    throw new Error('not-found');
  },
}));
vi.mock('next-intl/server', async () => ({
  getTranslations: (await import('../../../../../test/translations.ts')).getTranslations,
}));

const props = (locale: string) =>
  ({ params: Promise.resolve({ locale }), children: <h1>Screen</h1> }) as unknown as LayoutProps<'/[locale]/dashboard'>;

async function renderLayout(locale: 'tr' | 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {await PanelLayout(props(locale))}
    </NextIntlClientProvider>,
  );
}

describe('PanelLayout', () => {
  beforeEach(() => {
    mocks.guardPage.mockClear();
    mocks.guardPage.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.countUnreadMessages.mockClear();
    mocks.countUnreadMessages.mockResolvedValue(5);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('wraps the screen in the menu and the top bar for a signed-in visitor', async () => {
    await renderLayout('en');
    expect(mocks.guardPage).toHaveBeenCalledWith('en');
    expect(screen.getByRole('main').textContent).toBe('Screen');
    expect(screen.getByText('admin@example.com')).toBeTruthy();
    expect(screen.getByLabelText('5 unread messages').textContent).toBe('5');
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
    expect(screen.queryByText(/This is a demo/)).toBeNull();
  });

  it('shows the read-only notice in demo mode', async () => {
    vi.stubEnv('DEMO_MODE', 'true');
    await renderLayout('tr');
    expect(screen.getByText(/Bu bir demo/)).toBeTruthy();
  });

  it('shows nothing to a visitor without a session: the guard redirects', async () => {
    mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
    await expect(PanelLayout(props('en'))).rejects.toThrow('redirect:/en/admin/sign-in');
    expect(mocks.countUnreadMessages).not.toHaveBeenCalled();
  });

  it('answers an unknown language with not found before any session lookup', async () => {
    await expect(PanelLayout(props('xx'))).rejects.toThrow('not-found');
    expect(mocks.guardPage).not.toHaveBeenCalled();
  });
});
