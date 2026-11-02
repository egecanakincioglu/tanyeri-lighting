import { hasLocale, useLocale, useTranslations } from 'next-intl';
import { Link } from '../../i18n/navigation.ts';
import { routing } from '../../i18n/routing.ts';
import { getLegalPage } from '../../server/content/legal-pages.ts';
import { LEGAL_PAGE_KEYS, type SiteSettings, type SocialLink } from '../../server/content/schemas.ts';
import { listSocialLinks } from '../../server/content/social-links.ts';
import { Logo } from '../logo.tsx';
import { CONTAINER } from './container.ts';
import { FOOTER_NAV, LEGAL_PATHS } from './nav.ts';

export type LegalLink = { key: keyof typeof LEGAL_PATHS; title: { tr: string; en: string } };

const iconPaths: Record<string, string> = {
  instagram:
    'M7.5 3.5h9a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4h-9a4 4 0 0 1-4-4v-9a4 4 0 0 1 4-4zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM17 6.5v.01',
  facebook:
    'M14 21v-8h2.6l.4-3H14V8.2c0-.9.3-1.5 1.6-1.5H17V4.1C16.7 4.1 15.8 4 14.8 4 12.5 4 11 5.4 11 7.8V10H8.5v3H11v8',
  x: 'M4 4l16 16M20 4L4 20',
  linkedin:
    'M4 9h3.5v11H4zM5.75 4a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8zM10 9h3.3v1.6c.6-1.1 1.8-1.8 3.3-1.8 3 0 3.9 2 3.9 4.8V20H17v-5.8c0-1.4-.3-2.4-1.7-2.4-1.5 0-2.3 1-2.3 2.5V20h-3z',
  youtube: 'M3.5 8a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3zM10 9.5v5l4.5-2.5z',
  whatsapp:
    'M12 3a9 9 0 0 0-7.800 13.500L3 21l4.600-1.200A9 9 0 1 0 12 3zM9 8.500c0 3.500 3 6.500 6.500 6.500l1-1.600-2-1-1 .8c-1-.4-1.900-1.300-2.300-2.300l.8-1-1-2z',
};
const genericIcon =
  'M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1M14 10a4 4 0 0 0-5.700 0l-3 3A4 4 0 0 0 11 18.700l1-1';

function SocialIcon({ platform }: { platform: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={iconPaths[platform.toLowerCase()] ?? genericIcon} />
    </svg>
  );
}

const rowLabelClass = 'block text-xs leading-snug font-medium tracking-wider text-muted uppercase';
const linkClass = 'inline-flex min-h-touch items-center transition-colors duration-200 hover:text-accent-text';

type ContentProps = {
  settings: SiteSettings;
  socialLinks: SocialLink[];
  legal: LegalLink[];
  year: number;
};

export function FooterContent({ settings, socialLinks, legal, year }: ContentProps) {
  const t = useTranslations('Footer');
  const nav = useTranslations('Header');
  const current = useLocale();
  const locale = hasLocale(routing.locales, current) ? current : routing.defaultLocale;

  const rows: { label: string; value: string; href?: string }[] = [
    { label: t('address'), value: settings.address[locale] },
    { label: t('phone'), value: settings.phone, href: `tel:${settings.phone.replace(/[^\d+]/g, '')}` },
    { label: t('email'), value: settings.email, href: `mailto:${settings.email}` },
    { label: t('hours'), value: settings.workingHours[locale] },
  ].filter((row) => row.value.trim() !== '');

  return (
    <footer data-page-region className="border-t border-hairline bg-[#fbfaf8] pt-10 text-[0.9375rem] lg:pt-16">
      <div className={CONTAINER}>
        <div className="grid grid-cols-1 gap-9 pb-8 md:grid-cols-2 lg:grid-cols-3 lg:gap-x-[clamp(2rem,5vw,5rem)] lg:pb-12">
          <div className="md:col-span-2 lg:col-span-1">
            <Logo label="Tanyeri Lighting" variant="full" src={settings.logoUrl} />
            <p className="mt-5 max-w-104 leading-7 text-muted">{t('tagline')}</p>
            {socialLinks.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-2">
                {socialLinks.map((link) => (
                  <li key={link.id}>
                    <a
                      href={link.url}
                      rel="noopener noreferrer"
                      aria-label={link.label[locale]}
                      className="grid size-touch place-items-center rounded-lg border border-hairline text-muted transition-colors duration-200 hover:border-accent hover:bg-accent-tint hover:text-accent-text"
                    >
                      <SocialIcon platform={link.platform} />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <nav aria-label={t('siteNav')}>
            <h2 className="mb-4 text-[0.8125rem] font-bold tracking-widest uppercase">{t('siteNav')}</h2>
            <ul>
              {FOOTER_NAV.map((entry) => (
                <li key={entry.id}>
                  <Link href={entry.path} prefetch={false} className={linkClass}>
                    {nav(entry.id)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {rows.length > 0 && (
            <div>
              <h2 className="mb-4 text-[0.8125rem] font-bold tracking-widest uppercase">{t('contact')}</h2>
              <address className="flex flex-col gap-2 not-italic">
                {rows.map((row) => (
                  <div key={row.label}>
                    <span className={rowLabelClass}>{row.label}</span>
                    {row.href ? (
                      <a
                        href={row.href}
                        className="flex min-h-touch items-center leading-snug transition-colors duration-200 hover:text-accent-text"
                      >
                        {row.value}
                      </a>
                    ) : (
                      <span className="flex min-h-touch items-center leading-snug">{row.value}</span>
                    )}
                  </div>
                ))}
              </address>
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-hairline">
        <div
          className={`${CONTAINER} grid grid-cols-1 justify-items-center gap-1 py-3 text-center text-sm text-muted wide:grid-cols-[1fr_auto_1fr] wide:justify-items-start wide:py-2 wide:text-left`}
        >
          <p className="flex min-h-touch items-center">
            {t('copyright', { year, name: settings.siteName[locale] || 'Tanyeri' })}
          </p>
          <span className="inline-flex min-h-touch items-center gap-2 wide:col-start-2 wide:row-start-1 wide:justify-self-center">
            {t('poweredBy')}
            {/* A static file at exactly twice its shown size. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/flareye.png" alt="Flareye" width={96} height={24} />
          </span>
          <ul className="flex flex-wrap justify-center gap-x-6 wide:col-start-3 wide:row-start-1 wide:justify-self-end">
            {legal.map((page) => (
              <li key={page.key}>
                <Link
                  href={LEGAL_PATHS[page.key]}
                  prefetch={false}
                  className="inline-flex min-h-touch items-center hover:text-ink hover:underline"
                >
                  {page.title[locale]}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/dashboard/sign-in"
                prefetch={false}
                rel="nofollow"
                className="inline-flex min-h-touch items-center hover:text-ink hover:underline"
              >
                {t('adminSignIn')}
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

// The layout reads the settings once for the header and the footer.
export async function Footer({ settings }: { settings: SiteSettings }) {
  const [socialLinks, pages] = await Promise.all([
    listSocialLinks(),
    Promise.all(LEGAL_PAGE_KEYS.map(async (key) => ({ key, page: await getLegalPage(key) }))),
  ]);
  const legal = pages.flatMap(({ key, page }) => (page ? [{ key, title: page.title }] : []));
  return <FooterContent settings={settings} socialLinks={socialLinks} legal={legal} year={new Date().getFullYear()} />;
}
