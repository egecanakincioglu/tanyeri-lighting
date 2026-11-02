import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../../../../../test/axe.ts';
import AboutAdminPage, { generateMetadata } from './page.tsx';

const mocks = vi.hoisted(() => ({ guardPage: vi.fn(), getAboutPage: vi.fn(), update: vi.fn() }));

vi.mock('../../../../../../server/auth/guard.ts', () => ({ guardPage: mocks.guardPage }));
vi.mock('../../../../../../server/content/about-page.ts', () => ({ getAboutPage: mocks.getAboutPage }));
vi.mock('../../../../../../server/admin/corporate-actions.ts', () => ({ updateAboutPageAction: mocks.update }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('not-found');
  },
}));
vi.mock('next-intl/server', async () => ({
  getTranslations: (await import('../../../../../../test/translations.ts')).getTranslations,
}));

const about = {
  body: { tr: 'Hakkımızda **metni**', en: 'About **text**' },
  vision: { tr: 'Vizyon metni', en: 'Vision text' },
};

const props = (locale: string) => ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/dashboard/about'>;

const inIntl = (locale: 'tr' | 'en', node: ReactNode) =>
  render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {node}
    </NextIntlClientProvider>,
  );

describe('about and vision screen', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockClear();
    mocks.guardPage.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.getAboutPage.mockResolvedValue(about);
    mocks.update.mockResolvedValue({ status: 'success' });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('shows the four texts, two per language', async () => {
    inIntl('en', await AboutAdminPage(props('en')));
    expect(mocks.guardPage).toHaveBeenCalledWith('en');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('About and Vision');
    expect((screen.getByLabelText('English', { selector: '#body-en' }) as HTMLTextAreaElement).value).toBe(
      'About **text**',
    );
    expect((screen.getByLabelText('Turkish', { selector: '#vision-tr' }) as HTMLTextAreaElement).value).toBe(
      'Vizyon metni',
    );
    expect(screen.getAllByRole('button', { name: 'Preview' })).toHaveLength(4);
  });

  it('is Turkish at the Turkish address', async () => {
    inIntl('tr', await AboutAdminPage(props('tr')));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Hakkımızda ve Vizyon');
  });

  it('previews the Markdown of a text', async () => {
    inIntl('en', await AboutAdminPage(props('en')));
    fireEvent.click(screen.getAllByRole('button', { name: 'Preview' })[1]!);
    await waitFor(() => expect(screen.getByText('text').tagName).toBe('STRONG'), { timeout: 5000 });
  });

  it('saves the four texts', async () => {
    inIntl('en', await AboutAdminPage(props('en')));
    fireEvent.change(screen.getByLabelText('English', { selector: '#vision-en' }), { target: { value: 'New vision' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    const data = mocks.update.mock.calls[0]![1] as FormData;
    expect(data.get('vision.en')).toBe('New vision');
    expect(data.get('body.tr')).toBe('Hakkımızda **metni**');
    await waitFor(() => expect(screen.getByText('Saved.')).toBeTruthy());
  });

  it('shows the error of each field and keeps what was typed', async () => {
    mocks.update.mockResolvedValue({
      status: 'error',
      code: 'invalid',
      fieldErrors: { 'body.en': { code: 'required' }, 'vision.tr': { code: 'tooLong', max: 50_000 } },
    });
    inIntl('en', await AboutAdminPage(props('en')));
    fireEvent.change(screen.getByLabelText('English', { selector: '#body-en' }), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('This field is required.')).toBeTruthy());
    expect(screen.getByText('At most 50000 characters.')).toBeTruthy();
    expect((screen.getByLabelText('English', { selector: '#body-en' }) as HTMLTextAreaElement).value).toBe('');
  });

  it('turns saving off in the demo', async () => {
    vi.stubEnv('DEMO_MODE', 'true');
    inIntl('en', await AboutAdminPage(props('en')));
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/In the demo/)).toBeTruthy();
  });

  it('refuses a visitor without a session and an unknown language', async () => {
    mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
    await expect(AboutAdminPage(props('en'))).rejects.toThrow('redirect:');
    expect(mocks.getAboutPage).not.toHaveBeenCalled();
    await expect(AboutAdminPage(props('xx'))).rejects.toThrow('not-found');
  });

  it('is kept out of search results and has no axe violations', async () => {
    expect(await generateMetadata(props('en'))).toMatchObject({ robots: { index: false, follow: false } });
    const { container } = inIntl('en', await AboutAdminPage(props('en')));
    expect(await axeViolations(container)).toEqual([]);
  });
});
