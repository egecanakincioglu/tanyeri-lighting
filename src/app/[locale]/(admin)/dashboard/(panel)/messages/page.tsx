import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '../../../../../../components/admin/page-header.tsx';
import { Link } from '../../../../../../i18n/navigation.ts';
import { routing } from '../../../../../../i18n/routing.ts';
import { guardPage } from '../../../../../../server/auth/guard.ts';
import { listMessages } from '../../../../../../server/contact/service.ts';
import { isDemoMode } from '../../../../../../server/env.ts';

// Fifty rows a page; the next page continues after the last row shown.
const PAGE_SIZE = 50;
const PREVIEW_LENGTH = 140;
const MAX_CURSOR_LENGTH = 64;

const linkClass =
  'inline-flex min-h-touch items-center justify-center rounded-md border border-hairline bg-surface px-5 text-[0.9375rem] font-semibold hover:border-accent hover:text-accent-text';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/messages'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminMessages' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

function preview(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > PREVIEW_LENGTH ? `${flat.slice(0, PREVIEW_LENGTH).trimEnd()}…` : flat;
}

export default async function MessagesAdminPage({ params, searchParams }: PageProps<'/[locale]/dashboard/messages'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const query = await searchParams;
  const raw = query.cursor;
  const cursor = typeof raw === 'string' && raw.length > 0 && raw.length <= MAX_CURSOR_LENGTH ? raw : undefined;
  const [t, page] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminMessages' }),
    listMessages({ limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) }),
  ]);
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Istanbul',
  });

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      {page.items.length === 0 ? (
        <p className="rounded-lg border border-hairline bg-surface px-5 py-10 text-center text-muted">
          {isDemoMode() ? t('emptyDemo') : t('empty')}
        </p>
      ) : (
        <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-surface">
          {page.items.map((message) => (
            <li key={message.id}>
              <Link
                prefetch={false}
                href={{ pathname: '/dashboard/messages/[id]', params: { id: message.id } }}
                aria-label={`${t('open')}: ${message.subject}`}
                className="flex min-h-touch flex-col gap-1 p-4 hover:bg-page sm:p-5"
              >
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                  <time dateTime={message.createdAt.toISOString()}>{date.format(message.createdAt)}</time>
                  {!message.readAt && (
                    <span className="rounded-full bg-accent-tint px-2.5 py-0.5 text-xs font-semibold text-accent-text">
                      {t('unread')}
                    </span>
                  )}
                </span>
                <span className={`wrap-break-word ${message.readAt ? 'font-semibold' : 'font-bold'}`}>
                  {message.name}
                  <span className="font-normal text-muted"> · </span>
                  {message.subject}
                </span>
                <span className="wrap-break-word text-sm text-muted">{preview(message.message)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {(cursor || page.nextCursor) && (
        <nav className="mt-4 flex flex-wrap gap-3">
          {cursor && (
            <Link prefetch={false} href="/dashboard/messages" className={linkClass}>
              {t('newest')}
            </Link>
          )}
          {page.nextCursor && (
            <Link
              prefetch={false}
              href={{ pathname: '/dashboard/messages', query: { cursor: page.nextCursor } }}
              className={linkClass}
            >
              {t('older')}
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
