import { useLocale, useTranslations } from 'next-intl';
import { Link } from '../../i18n/navigation.ts';
import { routing } from '../../i18n/routing.ts';
import { Logo } from '../logo.tsx';
import { HeaderMenu, type MenuItem } from './header-menu.tsx';
import { CONTACT_PATH, NAV } from './nav.ts';

type HeaderProps = {
  logoUrl?: string | null;
  /** The product categories, named in the page language, listed under Products. */
  categories?: { key: string; name: string }[];
};

export function Header({ logoUrl, categories = [] }: HeaderProps) {
  const t = useTranslations('Header');
  const locale = useLocale();

  const items: MenuItem[] = NAV.map((entry) => ({
    label: t(entry.id),
    href: entry.path,
    children: entry.children && [
      ...entry.children.map((child) => ({ label: t(child.id), href: child.path })),
      ...(entry.id === 'products'
        ? categories.map((category) => ({
            label: category.name,
            href: '/products' as const,
            query: { category: category.key },
          }))
        : []),
    ],
  }));

  return (
    <HeaderMenu
      locale={locale}
      items={items}
      contact={{ label: t('contact'), href: CONTACT_PATH }}
      languages={routing.locales.map((code) => ({
        locale: code,
        code: code.toUpperCase(),
        name: t(code === 'tr' ? 'languageTr' : 'languageEn'),
      }))}
      labels={{
        language: t('language'),
        menu: t('menu'),
        openMenu: t('openMenu'),
        closeMenu: t('closeMenu'),
      }}
      logo={
        // On phones the logo is narrowed so it fits next to the language links and the menu button at 320 px; the file
        // stays between one and two times the shown size on dense screens.
        <Link
          href="/"
          prefetch={false}
          aria-label={t('logoLabel')}
          className="flex min-h-touch min-w-0 items-center max-xs:[&>img]:h-auto max-xs:[&>img]:w-35"
        >
          <Logo label="Tanyeri Lighting" src={logoUrl} />
        </Link>
      }
    />
  );
}
