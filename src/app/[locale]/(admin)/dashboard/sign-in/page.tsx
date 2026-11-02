import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { AdminShell } from '../../../../../components/admin/shell.tsx';
import { SignInForm } from '../../../../../components/admin/sign-in-form.tsx';
import { Link } from '../../../../../i18n/navigation.ts';
import { routing } from '../../../../../i18n/routing.ts';
import { currentSession } from '../../../../../server/auth/guard.ts';
import { panelPath } from '../../../../../server/auth/paths.ts';
import { isPasswordResetAvailable } from '../../../../../server/auth/reset-available.ts';
import { signInAction } from '../../../../../server/auth/sign-in-action.ts';
import { getDemoAdminCredentials, isDemoMode } from '../../../../../server/env.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/sign-in'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Admin' });
  return { title: t('signInTitle'), robots: { index: false, follow: false } };
}

export default async function SignInPage({ params }: PageProps<'/[locale]/dashboard/sign-in'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Public page: it can not require a session. A signed-in visitor goes on to the panel instead.
  if (await currentSession()) redirect(panelPath(locale));
  const t = await getTranslations({ locale, namespace: 'Admin' });
  // The public demo shows its read-only account here, and nothing else ever shows a credential.
  const demoAccount = isDemoMode() ? getDemoAdminCredentials() : undefined;

  return (
    <AdminShell locale={locale} logoLabel={t('logo')} backLabel={t('backToSite')}>
      <h1 className="text-2xl font-bold">{t('signInTitle')}</h1>
      <div className="mt-6">
        <SignInForm
          action={signInAction}
          locale={locale}
          texts={{
            email: t('email'),
            passLabel: t('passLabel'),
            submit: t('submit'),
            submitting: t('submitting'),
            error: t('error'),
            rateLimited: t('rateLimited'),
          }}
        />
      </div>
      {demoAccount && (
        <section aria-labelledby="demo-account" className="mt-6 rounded-md bg-accent-tint p-4 text-sm">
          <h2 id="demo-account" className="font-semibold">
            {t('demoTitle')}
          </h2>
          <p className="mt-1 leading-6">{t('demoText')}</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="font-semibold">{t('demoEmail')}</dt>
            <dd className="break-all">
              <code>{demoAccount.email}</code>
            </dd>
            <dt className="font-semibold">{t('demoPass')}</dt>
            <dd className="break-all">
              <code>{demoAccount.password}</code>
            </dd>
          </dl>
        </section>
      )}
      <section className="mt-8 border-t border-hairline pt-5 text-sm text-muted">
        <h2 className="font-semibold text-ink">{t('forgotTitle')}</h2>
        {isPasswordResetAvailable() ? (
          <Link
            href="/dashboard/forgot-password"
            prefetch={false}
            className="inline-flex min-h-touch items-center font-medium text-ink underline underline-offset-4"
          >
            {t('forgotLink')}
          </Link>
        ) : (
          <p className="mt-1 leading-6">{t('forgotText')}</p>
        )}
      </section>
    </AdminShell>
  );
}
