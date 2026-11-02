import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { AdminShell } from '../../../../../components/admin/shell.tsx';
import { SignInForm } from '../../../../../components/admin/sign-in-form.tsx';
import { routing } from '../../../../../i18n/routing.ts';
import { currentSession } from '../../../../../server/auth/guard.ts';
import { panelPath } from '../../../../../server/auth/paths.ts';
import { signInAction } from '../../../../../server/auth/sign-in-action.ts';

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

  return (
    <AdminShell logoLabel={t('logo')} backLabel={t('backToSite')}>
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
      <section className="mt-8 border-t border-hairline pt-5 text-sm text-muted">
        <h2 className="font-semibold text-ink">{t('forgotTitle')}</h2>
        <p className="mt-1 leading-6">{t('forgotText')}</p>
      </section>
    </AdminShell>
  );
}
