import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ResetPasswordForm } from '../../../../../components/admin/reset-forms.tsx';
import { ResetUnavailable } from '../../../../../components/admin/reset-unavailable.tsx';
import { AdminShell } from '../../../../../components/admin/shell.tsx';
import { routing } from '../../../../../i18n/routing.ts';
import { isPasswordResetAvailable } from '../../../../../server/auth/reset-available.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/reset-password'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminReset' });
  return { title: t('resetTitle'), robots: { index: false, follow: false } };
}

// Public page: the emailed link brings a visitor without a session. The auth layer checks the link's key when the
// form is sent, not this page.
export default async function ResetPasswordPage({
  params,
  searchParams,
}: PageProps<'/[locale]/dashboard/reset-password'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const { token } = await searchParams;
  const t = await getTranslations({ locale, namespace: 'AdminReset' });
  const admin = await getTranslations({ locale, namespace: 'Admin' });

  return (
    <AdminShell logoLabel={admin('logo')} backLabel={admin('backToSite')}>
      <h1 className="text-2xl font-bold">{t('resetTitle')}</h1>
      <div className="mt-6">
        {isPasswordResetAvailable() ? (
          <ResetPasswordForm
            resetKey={typeof token === 'string' ? token : ''}
            texts={{
              intro: t('resetText'),
              next: t('nextLabel'),
              repeat: t('repeatLabel'),
              hint: t('hint'),
              submit: t('resetSubmit'),
              submitting: t('resetSubmitting'),
              done: t('resetDone'),
              signIn: t('signIn'),
              invalidTitle: t('invalidTitle'),
              invalidText: t('invalidText'),
              requestAgain: t('requestAgain'),
              errors: { rateLimited: t('errors.rateLimited'), demo: t('errors.demo'), generic: t('errors.generic') },
              issues: { tooShort: t('issues.tooShort'), tooLong: t('issues.tooLong'), mismatch: t('issues.mismatch') },
            }}
          />
        ) : (
          <ResetUnavailable title={t('unavailableTitle')} text={t('unavailableText')} signIn={t('signIn')} />
        )}
      </div>
    </AdminShell>
  );
}
