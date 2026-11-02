import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ConfirmDelete } from '../../../../../../../components/admin/confirm-delete.tsx';
import { PageHeader } from '../../../../../../../components/admin/page-header.tsx';
import { buildFormTexts } from '../../../../../../../components/admin/texts.ts';
import { ButtonLink } from '../../../../../../../components/button.tsx';
import { Link } from '../../../../../../../i18n/navigation.ts';
import { routing } from '../../../../../../../i18n/routing.ts';
import { deleteMessageAction } from '../../../../../../../server/admin/messages-actions.ts';
import { guardPage } from '../../../../../../../server/auth/guard.ts';
import { getMessage, markMessageRead } from '../../../../../../../server/contact/service.ts';
import { isDemoMode } from '../../../../../../../server/env.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/messages/[id]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminMessages' });
  return { title: t('detailTitle'), robots: { index: false, follow: false } };
}

export default async function MessagePage({ params }: PageProps<'/[locale]/dashboard/messages/[id]'>) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, form, message] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminMessages' }),
    getTranslations({ locale, namespace: 'AdminForm' }),
    getMessage(id),
  ]);
  if (!message) notFound();
  // Opening a message is what reads it. The demo writes nothing.
  const demo = isDemoMode();
  if (!message.readAt && !demo) await markMessageRead(message.id);
  const formTexts = buildFormTexts(form);
  const sent = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Istanbul' });
  const reply = `mailto:${encodeURI(message.email)}?subject=${encodeURIComponent(t('replyPrefix') + message.subject)}`;

  return (
    <>
      <PageHeader title={message.subject} description={message.name} />
      <div className="flex flex-col gap-6">
        <dl className="grid gap-x-6 gap-y-4 rounded-lg border border-hairline bg-surface p-5 sm:grid-cols-[auto_1fr] sm:p-6">
          <dt className="text-sm font-semibold text-muted">{t('from')}</dt>
          <dd className="wrap-break-word">{message.name}</dd>
          <dt className="text-sm font-semibold text-muted">{t('email')}</dt>
          <dd className="wrap-break-word">{message.email}</dd>
          <dt className="text-sm font-semibold text-muted">{t('sentAt')}</dt>
          <dd>
            <time dateTime={message.createdAt.toISOString()}>{sent.format(message.createdAt)}</time>
          </dd>
          <dt className="text-sm font-semibold text-muted">{t('subject')}</dt>
          <dd className="wrap-break-word">{message.subject}</dd>
        </dl>
        <section className="rounded-lg border border-hairline bg-surface p-5 sm:p-6" aria-labelledby="message-body">
          <h2 id="message-body" className="mb-3 text-sm font-semibold text-muted">
            {t('body')}
          </h2>
          <p className="whitespace-pre-wrap wrap-break-word">{message.message}</p>
        </section>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={reply} prefetch={false}>
            {t('reply')}
          </ButtonLink>
          <ConfirmDelete
            name={message.subject}
            fields={{ id: message.id, locale }}
            action={deleteMessageAction}
            texts={{
              trigger: t('delete'),
              title: t('deleteTitle'),
              body: t('deleteBody'),
              confirm: t('deleteConfirm'),
              working: t('deleting'),
              cancel: form('cancel'),
            }}
            formTexts={formTexts}
            disabledReason={demo ? formTexts.demoNote : undefined}
          />
          <Link
            prefetch={false}
            href="/dashboard/messages"
            className="inline-flex min-h-touch items-center justify-center rounded-md border border-hairline bg-surface px-5 text-[0.9375rem] font-semibold hover:border-accent hover:text-accent-text"
          >
            {t('back')}
          </Link>
        </div>
      </div>
    </>
  );
}
