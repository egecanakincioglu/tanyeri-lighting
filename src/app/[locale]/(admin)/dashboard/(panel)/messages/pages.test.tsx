import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../../../../../test/axe.ts';
import MessagePage from './[id]/page.tsx';
import MessagesAdminPage, { generateMetadata } from './page.tsx';

const mocks = vi.hoisted(() => ({
  guardPage: vi.fn(),
  listMessages: vi.fn(),
  getMessage: vi.fn(),
  markMessageReadAction: vi.fn(),
}));

vi.mock('../../../../../../server/auth/guard.ts', () => ({ guardPage: mocks.guardPage }));
vi.mock('../../../../../../server/contact/service.ts', () => ({
  listMessages: mocks.listMessages,
  getMessage: mocks.getMessage,
}));
vi.mock('../../../../../../server/admin/messages-actions.ts', () => ({
  deleteMessageAction: vi.fn(),
  markMessageReadAction: mocks.markMessageReadAction,
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

const message = {
  id: 'm1',
  name: 'Ayşe Yılmaz',
  email: 'ayse@example.com',
  subject: 'Offer & prices',
  message: 'Hello,\n\nPlease send a price list.',
  locale: 'tr',
  createdAt: new Date('2026-11-01T09:30:00Z'),
  readAt: null as Date | null,
};

const listProps = (locale: string, cursor?: string) =>
  ({
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve(cursor ? { cursor } : {}),
  }) as unknown as PageProps<'/[locale]/dashboard/messages'>;
const detailProps = (locale: string, id: string) =>
  ({ params: Promise.resolve({ locale, id }) }) as PageProps<'/[locale]/dashboard/messages/[id]'>;

const inIntl = (locale: 'tr' | 'en', node: ReactNode) =>
  render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {node}
    </NextIntlClientProvider>,
  );

describe('message screens', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockClear();
    mocks.guardPage.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.listMessages.mockResolvedValue({
      items: [message, { ...message, id: 'm2', name: 'Can', subject: 'Second', readAt: new Date() }],
      nextCursor: null,
    });
    mocks.getMessage.mockResolvedValue({ ...message });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  describe('list', () => {
    it('shows each message with its name, subject and preview, and marks the unread one', async () => {
      inIntl('en', await MessagesAdminPage(listProps('en')));
      expect(mocks.guardPage).toHaveBeenCalledWith('en');
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Messages');
      const link = screen.getByRole('link', { name: /Offer & prices/ });
      expect(link.getAttribute('href')).toBe('/en/admin/messages/m1');
      // The accessible name is the visible text, so a voice-control user can say what they read.
      expect(link.hasAttribute('aria-label')).toBe(false);
      expect(screen.getByRole('link', { name: /Ayşe Yılmaz.*Offer & prices.*Please send a price list/ })).toBe(link);
      expect(screen.getAllByText('Hello, Please send a price list.')).toHaveLength(2);
      expect(screen.getAllByText('New')).toHaveLength(1);
      expect(mocks.listMessages).toHaveBeenCalledWith({ limit: 50 });
    });

    it('cuts a long message to a preview', async () => {
      mocks.listMessages.mockResolvedValue({ items: [{ ...message, message: 'word '.repeat(100) }], nextCursor: null });
      inIntl('en', await MessagesAdminPage(listProps('en')));
      expect(screen.getByText(/^word word.*…$/).textContent!.length).toBeLessThan(145);
    });

    it('links to the next page of fifty and back to the newest', async () => {
      mocks.listMessages.mockResolvedValue({ items: [message], nextCursor: 'm1' });
      inIntl('en', await MessagesAdminPage(listProps('en', 'c0')));
      expect(mocks.listMessages).toHaveBeenCalledWith({ limit: 50, cursor: 'c0' });
      expect(screen.getByRole('link', { name: 'Older messages' }).getAttribute('href')).toBe(
        '/en/admin/messages?cursor=m1',
      );
      expect(screen.getByRole('link', { name: 'Back to the newest' }).getAttribute('href')).toBe('/en/admin/messages');
    });

    it('ignores a cursor that is too long', async () => {
      await MessagesAdminPage(listProps('en', 'x'.repeat(65)));
      expect(mocks.listMessages).toHaveBeenCalledWith({ limit: 50 });
    });

    it('says there are no messages, and in the demo says why', async () => {
      mocks.listMessages.mockResolvedValue({ items: [], nextCursor: null });
      inIntl('en', await MessagesAdminPage(listProps('en')));
      expect(screen.getByText('No messages yet.')).toBeTruthy();
      cleanup();
      vi.stubEnv('DEMO_MODE', 'true');
      inIntl('tr', await MessagesAdminPage(listProps('tr')));
      expect(screen.getByText(/iletişim mesajları burada saklanmaz/)).toBeTruthy();
    });

    it('refuses a visitor without a session and an unknown language', async () => {
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(MessagesAdminPage(listProps('en'))).rejects.toThrow('redirect:');
      expect(mocks.listMessages).not.toHaveBeenCalled();
      await expect(MessagesAdminPage(listProps('xx'))).rejects.toThrow('not-found');
    });

    it('is kept out of search results and has no axe violations', async () => {
      expect(await generateMetadata(listProps('en'))).toMatchObject({ robots: { index: false, follow: false } });
      const { container } = inIntl('en', await MessagesAdminPage(listProps('en')));
      expect(await axeViolations(container)).toEqual([]);
    });
  });

  describe('one message', () => {
    it('shows all of it, a reply link with the subject filled in, and marks it read', async () => {
      const { container } = inIntl('en', await MessagePage(detailProps('en', 'm1')));
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Offer & prices');
      expect(screen.getByText('ayse@example.com')).toBeTruthy();
      expect(container.querySelector('p.whitespace-pre-wrap')!.textContent).toBe(message.message);
      expect(screen.getByRole('link', { name: 'Reply by e-mail' }).getAttribute('href')).toBe(
        'mailto:ayse@example.com?subject=Re%3A%20Offer%20%26%20prices',
      );
      expect(mocks.markMessageReadAction).toHaveBeenCalledWith('m1');
      expect(screen.getByRole('button', { name: 'Delete: Offer & prices' })).toBeTruthy();
    });

    it('does not mark a message that was read again, and writes nothing in the demo', async () => {
      mocks.getMessage.mockResolvedValue({ ...message, readAt: new Date() });
      expect(mocks.markMessageReadAction).not.toHaveBeenCalled();
      cleanup();
      expect(mocks.markMessageReadAction).not.toHaveBeenCalled();
      mocks.getMessage.mockResolvedValue({ ...message });
      vi.stubEnv('DEMO_MODE', 'true');
      inIntl('en', await MessagePage(detailProps('en', 'm1')));
      expect(mocks.markMessageReadAction).not.toHaveBeenCalled();
      expect((screen.getByRole('button', { name: 'Delete: Offer & prices' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('answers an unknown message with not found', async () => {
      mocks.getMessage.mockResolvedValue(null);
      await expect(MessagePage(detailProps('en', 'gone'))).rejects.toThrow('not-found');
    });

    it('refuses a visitor without a session and an unknown language', async () => {
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(MessagePage(detailProps('en', 'm1'))).rejects.toThrow('redirect:');
      expect(mocks.getMessage).not.toHaveBeenCalled();
      mocks.guardPage.mockResolvedValue({});
      await expect(MessagePage(detailProps('xx', 'm1'))).rejects.toThrow('not-found');
    });

    it('has no axe violations', async () => {
      const { container } = inIntl('en', await MessagePage(detailProps('en', 'm1')));
      expect(await axeViolations(container)).toEqual([]);
    });
  });
});
