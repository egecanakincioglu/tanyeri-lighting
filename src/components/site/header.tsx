import { hasLocale, useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { getPathname } from '../../i18n/navigation.ts';
import { routing, type StaticPath } from '../../i18n/routing.ts';
import { Logo } from '../logo.tsx';
import { HeaderMenu, type MenuItem } from './header-menu.tsx';
import type { SwitchRoute } from './language-switch.ts';
import { CONTACT_PATH, NAV } from './nav.ts';

type HeaderProps = {
  logoUrl?: string | null;
  categories?: { key: string; name: string }[];
};

// Full address of each public page in every language;
// the menu script swaps the language with this list, so it needs no routing code.
const LANGUAGE_ROUTES: SwitchRoute[] = Object.entries(routing.pathnames)
  .filter(([path]) => !path.startsWith('/dashboard'))
  .map(([, entry]) =>
    Object.fromEntries(
      routing.locales.map((code) => {
        const path = typeof entry === 'string' ? entry : entry[code];
        return [code, path === '/' ? `/${code}` : `/${code}${path}`];
      }),
    ),
  );

export function Header({ logoUrl, categories = [] }: HeaderProps) {
  const t = useTranslations('Header');
  const current = useLocale();
  const locale = hasLocale(routing.locales, current) ? current : routing.defaultLocale;
  const at = (path: StaticPath, query?: Record<string, string>) =>
    getPathname({
      locale,
      href: (query ? { pathname: path, query } : path) as Parameters<typeof getPathname>[0]['href'],
    });

  const items: MenuItem[] = NAV.map((entry) => ({
    label: t(entry.id),
    ...(entry.path ? { href: at(entry.path) } : {}),
    ...(entry.children
      ? {
          children: [
            ...entry.children.map((child) => ({ label: t(child.id), href: at(child.path) })),
            ...(entry.id === 'products'
              ? categories.map((category) => ({
                  label: category.name,
                  href: at('/products', { category: category.key }),
                }))
              : []),
          ],
        }
      : {}),
  }));

  return (
    <HeaderMenu
      locale={locale}
      items={items}
      contact={{ label: t('contact'), href: at(CONTACT_PATH) }}
      home={at('/')}
      routes={LANGUAGE_ROUTES}
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
        // On phones the logo is narrowed to fit next to the language links and menu button at 320 px;
        // the file stays between one and two times the shown size.
        <Link
          href={at('/')}
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
