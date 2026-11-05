import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AdminFrame } from '../../../../../components/admin/frame.tsx';
import { buildNavGroups } from '../../../../../components/admin/nav.ts';
import { Link } from '../../../../../i18n/navigation.ts';
import { Logo } from '../../../../../components/logo.tsx';
import { routing } from '../../../../../i18n/routing.ts';
import { countUnreadMessages } from '../../../../../server/admin/counts.ts';
import { guardPage } from '../../../../../server/auth/guard.ts';
import { signOutAction } from '../../../../../server/auth/sign-out-action.ts';
import { isDemoMode } from '../../../../../server/env.ts';

// Each page calls the guard itself: a layout does not re-run on client navigation.
export default async function PanelLayout({ children, params }: LayoutProps<'/[locale]/dashboard'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const session = await guardPage(locale);
  const [t, unread] = await Promise.all([getTranslations({ locale, namespace: 'AdminNav' }), countUnreadMessages()]);

  return (
    <NextIntlClientProvider locale={locale} messages={null}>
      <AdminFrame
        locale={locale}
        logo={
          <Link
            href="/"
            prefetch={false}
            className="inline-flex min-h-touch min-w-0 items-center [&_img]:h-auto [&_img]:max-w-full"
          >
            <Logo label={t('logo')} />
          </Link>
        }
        groups={buildNavGroups(t, unread)}
        email={session.user.email}
        {...(isDemoMode() ? { demoNotice: t('demoNotice') } : {})}
        signOut={{ action: signOutAction, label: t('signOut') }}
        labels={{ menu: t('menu'), openMenu: t('openMenu'), closeMenu: t('closeMenu'), viewSite: t('viewSite') }}
      >
        {children}
      </AdminFrame>
    </NextIntlClientProvider>
  );
}
