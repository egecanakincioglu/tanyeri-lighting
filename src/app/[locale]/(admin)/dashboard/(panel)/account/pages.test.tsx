import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../../../../../test/axe.ts';
import AccountPage, { generateMetadata } from './page.tsx';

const mocks = vi.hoisted(() => ({ guardPage: vi.fn(), changePassword: vi.fn(), changeEmail: vi.fn() }));

vi.mock('../../../../../../server/auth/guard.ts', () => ({ guardPage: mocks.guardPage }));
vi.mock('../../../../../../server/admin/account-actions.ts', () => ({
  changePasswordAction: mocks.changePassword,
  changeEmailAction: mocks.changeEmail,
}));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('not-found');
  },
}));
vi.mock('next-intl/server', async () => ({
  getTranslations: (await import('../../../../../../test/translations.ts')).getTranslations,
}));

const props = (locale: string) => ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/dashboard/account'>;

const inIntl = (locale: 'tr' | 'en', node: ReactNode) =>
  render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {node}
    </NextIntlClientProvider>,
  );

const SMTP = {
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_USER: 'mailer',
  SMTP_PASSWORD: 'mailer-password',
  SMTP_FROM: 'Tanyeri <no-reply@example.com>',
};

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe('account screen', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockClear();
    mocks.guardPage.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.changePassword.mockResolvedValue({ status: 'success' });
    mocks.changeEmail.mockResolvedValue({ status: 'success' });
    for (const [name, value] of Object.entries(SMTP)) vi.stubEnv(name, value);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('shows who is signed in and both forms with the right autocomplete values', async () => {
    inIntl('en', await AccountPage(props('en')));
    expect(mocks.guardPage).toHaveBeenCalledWith('en');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('My Account');
    expect(screen.getByText(/Signed in as admin@example.com/)).toBeTruthy();
    expect(screen.getByLabelText('Current password').getAttribute('autocomplete')).toBe('current-password');
    expect(screen.getByLabelText('New password').getAttribute('autocomplete')).toBe('new-password');
    expect(screen.getByLabelText('New password again').getAttribute('autocomplete')).toBe('new-password');
    expect(screen.getByLabelText('New e-mail address').getAttribute('autocomplete')).toBe('username');
  });

  it('sends the typed passwords, and empties the form once the password is changed', async () => {
    inIntl('en', await AccountPage(props('en')));
    fill('Current password', 'old one');
    fill('New password', 'a brand new one');
    fill('New password again', 'a brand new one');
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'Change the password' }).closest('form')!);
    });
    const sent = Object.fromEntries((mocks.changePassword.mock.calls[0]![1] as FormData).entries());
    expect(sent).toEqual({ currentPassword: 'old one', newPassword: 'a brand new one', confirm: 'a brand new one' });
    expect(screen.getByText(/Every other device was signed out/)).toBeTruthy();
    expect((screen.getByLabelText('Current password') as HTMLInputElement).value).toBe('');
  });

  it('shows the error under each field and keeps what was typed', async () => {
    mocks.changePassword.mockResolvedValue({
      status: 'error',
      code: 'invalid',
      fields: { currentPassword: 'wrongCurrent', confirm: 'mismatch' },
    });
    inIntl('en', await AccountPage(props('en')));
    fill('Current password', 'typed');
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'Change the password' }).closest('form')!);
    });
    expect(document.getElementById('currentPassword-error')!.textContent).toBe('The current password is not right.');
    expect(document.getElementById('confirm-error')!.textContent).toBe('The two passwords are not the same.');
    expect(screen.getByText('Some fields need to be corrected.')).toBeTruthy();
    expect((screen.getByLabelText('Current password') as HTMLInputElement).value).toBe('typed');
  });

  it('says when too many attempts were made', async () => {
    mocks.changeEmail.mockResolvedValue({ status: 'error', code: 'rateLimited', fields: {} });
    inIntl('en', await AccountPage(props('en')));
    fill('New e-mail address', 'new@example.com');
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'Send the confirmation link' }).closest('form')!);
    });
    expect(screen.getByText('Too many attempts. Wait a minute and try again.')).toBeTruthy();
  });

  it('sends the new address with the language, and tells that a link was sent', async () => {
    inIntl('tr', await AccountPage(props('tr')));
    fill('Yeni e-posta adresi', 'new@example.com');
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'Onay bağlantısını gönder' }).closest('form')!);
    });
    const sent = Object.fromEntries((mocks.changeEmail.mock.calls[0]![1] as FormData).entries());
    expect(sent).toEqual({ locale: 'tr', email: 'new@example.com' });
    expect(screen.getByText(/onay bağlantısı gönderildi/)).toBeTruthy();
  });

  it('turns both forms off in the demo and says why', async () => {
    vi.stubEnv('DEMO_MODE', 'true');
    inIntl('en', await AccountPage(props('en')));
    for (const name of ['Change the password', 'Send the confirmation link']) {
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect((screen.getByLabelText('Current password') as HTMLInputElement).disabled).toBe(true);
    expect(screen.getAllByText(/In the demo/)).toHaveLength(2);
  });

  it('turns only the e-mail form off while outgoing e-mail is not set up', async () => {
    for (const name of Object.keys(SMTP)) vi.stubEnv(name, '');
    inIntl('en', await AccountPage(props('en')));
    expect((screen.getByRole('button', { name: 'Send the confirmation link' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole('button', { name: 'Change the password' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(/needs outgoing e-mail/)).toBeTruthy();
  });

  it('refuses a visitor without a session and an unknown language, and is kept out of search results', async () => {
    mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
    await expect(AccountPage(props('en'))).rejects.toThrow('redirect:');
    mocks.guardPage.mockResolvedValue({ user: { email: 'admin@example.com' } });
    await expect(AccountPage(props('xx'))).rejects.toThrow('not-found');
    expect(await generateMetadata(props('en'))).toMatchObject({ robots: { index: false, follow: false } });
  });

  it('has no axe violations', async () => {
    const { container } = inIntl('en', await AccountPage(props('en')));
    expect(await axeViolations(container)).toEqual([]);
  });
});
