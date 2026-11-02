import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../../../../../test/axe.ts';
import SectionPage, { generateMetadata } from './page.tsx';

const mocks = vi.hoisted(() => ({ guardPage: vi.fn() }));

vi.mock('../../../../../../server/auth/guard.ts', () => ({ guardPage: mocks.guardPage }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('not-found');
  },
}));
vi.mock('next-intl/server', async () => ({
  getTranslations: (await import('../../../../../../test/translations.ts')).getTranslations,
}));

const props = (locale: string, section: string) =>
  ({ params: Promise.resolve({ locale, section }) }) as PageProps<'/[locale]/dashboard/[section]'>;

describe('SectionPage', () => {
  beforeEach(() => {
    mocks.guardPage.mockClear();
    mocks.guardPage.mockResolvedValue({ user: { email: 'admin@example.com' } });
  });
  afterEach(cleanup);

  it('shows the title of the menu item and a note that the screen comes next', async () => {
    render(await SectionPage(props('en', 'featured-products')));
    expect(mocks.guardPage).toHaveBeenCalledWith('en');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Featured Products');
    expect(screen.getByText('This section is coming in the next step.')).toBeTruthy();
  });

  it('uses the Turkish label', async () => {
    render(await SectionPage(props('tr', 'services')));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Hizmetler');
  });

  it('answers an address that is no screen of the panel with not found', async () => {
    await expect(SectionPage(props('en', 'nope'))).rejects.toThrow('not-found');
    await expect(SectionPage(props('xx', 'services'))).rejects.toThrow('not-found');
  });

  it('shows nothing to a visitor without a session: the guard redirects', async () => {
    mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
    await expect(SectionPage(props('en', 'services'))).rejects.toThrow('redirect:/en/admin/sign-in');
  });

  it('names the page in its metadata and keeps it out of search results', async () => {
    expect(await generateMetadata(props('en', 'services'))).toMatchObject({
      title: 'Services',
      robots: { index: false, follow: false },
    });
  });

  it('has no axe violations', async () => {
    const { container } = render(await SectionPage(props('en', 'services')));
    expect(await axeViolations(container)).toEqual([]);
  });
});
