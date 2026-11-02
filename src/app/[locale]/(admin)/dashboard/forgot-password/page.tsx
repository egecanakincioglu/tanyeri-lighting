import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { RequestResetForm } from '../../../../../components/admin/reset-forms.tsx';
import { ResetUnavailable } from '../../../../../components/admin/reset-unavailable.tsx';
import { AdminShell } from '../../../../../components/admin/shell.tsx';
import { routing } from '../../../../../i18n/routing.ts';
import { isPasswordResetAvailable } from '../../../../../server/auth/reset-available.ts';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/dashboard/forgot-password'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminReset' });
  return { title: t('requestTitle'), robots: { index: false, follow: false } };
}

// Public page: it is for a visitor who has lost the password, so it can not require a session.
export default async function ForgotPasswordPage({ params }: PageProps<'/[locale]/dashboard/forgot-password'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: 'AdminReset' });
  const admin = await getTranslations({ locale, namespace: 'Admin' });

  return (
    <AdminShell logoLabel={admin('logo')} backLabel={admin('backToSite')}>
      <h1 className="text-2xl font-bold">{t('requestTitle')}</h1>
      <div className="mt-6">
        {isPasswordResetAvailable() ? (
          <RequestResetForm
            texts={{
              intro: t('requestText'),
              email: t('email'),
              submit: t('requestSubmit'),
              submitting: t('requestSubmitting'),
              done: t('requestDone'),
              signIn: t('signIn'),
              errors: { rateLimited: t('errors.rateLimited'), demo: t('errors.demo'), generic: t('errors.generic') },
            }}
          />
        ) : (
          <ResetUnavailable title={t('unavailableTitle')} text={t('unavailableText')} signIn={t('signIn')} />
        )}
      </div>
    </AdminShell>
  );
}
