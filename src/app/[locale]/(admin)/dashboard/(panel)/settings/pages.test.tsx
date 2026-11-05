import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../../../../../test/axe.ts';
import SettingsAdminPage, { generateMetadata } from './page.tsx';

const mocks = vi.hoisted(() => ({
  guardPage: vi.fn(),
  getSiteSettings: vi.fn(),
  listSocialLinks: vi.fn(),
  reorder: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
}));

vi.mock('../../../../../../server/auth/guard.ts', () => ({ guardPage: mocks.guardPage }));
vi.mock('../../../../../../server/content/site-settings.ts', () => ({ getSiteSettings: mocks.getSiteSettings }));
vi.mock('../../../../../../server/content/social-links.ts', () => ({ listSocialLinks: mocks.listSocialLinks }));
vi.mock('../../../../../../server/admin/corporate-actions.ts', () => ({
  updateSiteSettingsAction: mocks.update,
  createSocialLinkAction: mocks.create,
  updateSocialLinkAction: vi.fn(),
  deleteSocialLinkAction: vi.fn(),
  reorderSocialLinksAction: mocks.reorder,
}));
vi.mock('../../../../../../server/admin/upload-actions.ts', () => ({ finalizeMediaAction: vi.fn() }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('not-found');
  },
}));
vi.mock('next-intl/server', async () => ({
  getTranslations: (await import('../../../../../../test/translations.ts')).getTranslations,
}));

const settings = {
  siteName: { tr: 'Tanyeri Aydınlatma', en: 'Tanyeri Lighting' },
  logoUrl: null,
  phone: '+90 212 000 00 00',
  email: 'info@example.com',
  address: { tr: 'Örnek Mahallesi 1', en: 'Example District 1' },
  workingHours: { tr: 'Hafta içi', en: 'Weekdays' },
  serviceArea: { tr: 'Türkiye', en: 'Turkey' },
  languages: { tr: 'Türkçe', en: 'Turkish' },
};

const links = [
  { id: 'l1', platform: 'instagram', label: { tr: 'Instagram', en: 'Instagram' }, url: 'https://example.com/a' },
  { id: 'l2', platform: 'facebook', label: { tr: 'Facebook', en: 'Facebook' }, url: 'https://example.com/b' },
];

const props = (locale: string) =>
  ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/dashboard/settings'>;

const inIntl = (locale: 'tr' | 'en', node: ReactNode) =>
  render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {node}
    </NextIntlClientProvider>,
  );

describe('company settings screen', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockClear();
    mocks.guardPage.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.getSiteSettings.mockResolvedValue(settings);
    mocks.listSocialLinks.mockResolvedValue(links);
    mocks.reorder.mockResolvedValue({ status: 'success' });
    mocks.update.mockResolvedValue({ status: 'success' });
    mocks.create.mockResolvedValue({ status: 'success' });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('fills the form with the stored details and lists the social links', async () => {
    inIntl('en', await SettingsAdminPage(props('en')));
    expect(mocks.guardPage).toHaveBeenCalledWith('en');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Company Settings');
    expect((screen.getByLabelText('Phone') as HTMLInputElement).value).toBe('+90 212 000 00 00');
    expect((screen.getByLabelText('Turkish', { selector: '#siteName-tr' }) as HTMLInputElement).value).toBe(
      'Tanyeri Aydınlatma',
    );
    expect((screen.getByLabelText('Platform', { selector: '#link-l2-platform' }) as HTMLInputElement).value).toBe(
      'facebook',
    );
    expect(screen.getByText(/File upload is off on this site/)).toBeTruthy();
  });

  it('is Turkish at the Turkish address', async () => {
    inIntl('tr', await SettingsAdminPage(props('tr')));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Kurumsal Ayarlar');
    expect(screen.getByLabelText('Telefon')).toBeTruthy();
  });

  it('shows an empty list message and still offers the add form', async () => {
    mocks.listSocialLinks.mockResolvedValue([]);
    inIntl('en', await SettingsAdminPage(props('en')));
    expect(screen.getByText('There are no social links yet.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add link' })).toBeTruthy();
  });

  it('saves the details and shows the answer', async () => {
    inIntl('en', await SettingsAdminPage(props('en')));
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '+90 212 000 00 01' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]!);
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    const data = mocks.update.mock.calls[0]![1] as FormData;
    expect(data.get('phone')).toBe('+90 212 000 00 01');
    expect(data.get('siteName.en')).toBe('Tanyeri Lighting');
    await waitFor(() => expect(screen.getAllByText('Saved.').length).toBeGreaterThan(0));
  });

  it('shows the error of each field and keeps what was typed', async () => {
    mocks.update.mockResolvedValue({
      status: 'error',
      code: 'invalid',
      fieldErrors: { email: { code: 'invalid' }, 'siteName.en': { code: 'required' } },
    });
    inIntl('en', await SettingsAdminPage(props('en')));
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'broken' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]!);
    await waitFor(() => expect(screen.getByText('Missing or invalid value.')).toBeTruthy());
    expect(screen.getByText('This field is required.')).toBeTruthy();
    expect((screen.getByLabelText('E-mail') as HTMLInputElement).value).toBe('broken');
  });

  it('moves a link down and sends the complete order', async () => {
    inIntl('en', await SettingsAdminPage(props('en')));
    fireEvent.click(screen.getByRole('button', { name: 'Move down: instagram' }));
    await waitFor(() => expect(mocks.reorder).toHaveBeenCalledWith(['l2', 'l1']));
    fireEvent.click(screen.getByRole('button', { name: 'Move up: instagram' }));
    expect(mocks.reorder).toHaveBeenCalledTimes(1);
  });

  it('adds a link and empties the add form', async () => {
    inIntl('en', await SettingsAdminPage(props('en')));
    const url = screen.getByLabelText('Address (https)', { selector: '#link-new-url' }) as HTMLInputElement;
    fireEvent.change(url, { target: { value: 'https://example.com/new' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    expect((mocks.create.mock.calls[0]![1] as FormData).get('url')).toBe('https://example.com/new');
    await waitFor(() => expect(url.value).toBe(''));
  });

  it('turns every control off in the demo', async () => {
    vi.stubEnv('DEMO_MODE', 'true');
    inIntl('en', await SettingsAdminPage(props('en')));
    for (const button of screen.getAllByRole('button', { name: 'Save' })) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
    expect((screen.getByRole('button', { name: 'Add link' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Delete: instagram' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Move down: instagram' }));
    expect(mocks.reorder).not.toHaveBeenCalled();
  });

  it('refuses a visitor without a session and an unknown language', async () => {
    mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
    await expect(SettingsAdminPage(props('en'))).rejects.toThrow('redirect:');
    expect(mocks.getSiteSettings).not.toHaveBeenCalled();
    await expect(SettingsAdminPage(props('xx'))).rejects.toThrow('not-found');
  });

  it('is kept out of search results and has no axe violations', async () => {
    expect(await generateMetadata(props('en'))).toMatchObject({ robots: { index: false, follow: false } });
    const { container } = inIntl('en', await SettingsAdminPage(props('en')));
    expect(await axeViolations(container)).toEqual([]);
  });
});
