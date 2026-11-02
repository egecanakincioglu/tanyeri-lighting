import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AdminShell } from '../../../../components/admin/shell.tsx';
import { Button } from '../../../../components/button.tsx';
import { routing } from '../../../../i18n/routing.ts';
import { guardPage } from '../../../../server/auth/guard.ts';
import { signOutAction } from '../../../../server/auth/sign-out-action.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Admin' });
  return { title: t('panelTitle'), robots: { index: false, follow: false } };
}

export default async function PanelPage({ params }: PageProps<'/[locale]/dashboard'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const session = await guardPage(locale);
  const t = await getTranslations({ locale, namespace: 'Admin' });

  return (
    <AdminShell logoLabel={t('logo')} backLabel={t('backToSite')}>
      <h1 className="text-2xl font-bold">{t('panelTitle')}</h1>
      <p className="mt-2 text-muted">{t('signedInAs', { email: session.user.email })}</p>
      <p className="mt-4">{t('next')}</p>
      <form action={signOutAction} className="mt-6">
        <input type="hidden" name="locale" value={locale} />
        <Button type="submit" variant="outline">
          {t('signOut')}
        </Button>
      </form>
    </AdminShell>
  );
}
