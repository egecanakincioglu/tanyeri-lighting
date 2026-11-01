import { hasLocale, useLocale, useTranslations } from 'next-intl';
import { routing } from '../../i18n/routing.ts';
import type { ContactState } from '../../server/contact/form.ts';
import type { SiteSettings } from '../../server/content/schemas.ts';
import { Container } from '../container.tsx';
import { SectionTitle } from '../section-title.tsx';
import { ContactForm } from './contact-form.tsx';

const iconPaths = {
  address:
    'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.400-6.500 11-6.500 11zM12 7.500a2.500 2.500 0 1 0 0 5 2.500 2.500 0 0 0 0-5z',
  phone:
    'M5 4h3.500l1.500 4-2 1.300a11 11 0 0 0 5.700 5.700L15 13l4 1.500V18a2 2 0 0 1-2 2A13 13 0 0 1 3 6a2 2 0 0 1 2-2z',
  email: 'M4 6h16v12H4zM4 7l8 6 8-6',
  hours: 'M12 3.500a8.500 8.500 0 1 0 0 17 8.500 8.500 0 0 0 0-17zM12 7.500V12l3 2',
} as const;

function Icon({ name }: { name: keyof typeof iconPaths }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-6 shrink-0 text-accent-text"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}

type ContactViewProps = {
  settings: SiteSettings;
  action: (previous: ContactState | null, formData: FormData) => Promise<ContactState>;
  honeypotName: string;
  limits: { name: number; email: number; subject: number; message: number };
  /** A product the visitor asks about: its name and code in the page language. */
  product?: { name: string; code: string };
};

export function ContactView({ settings, action, honeypotName, limits, product }: ContactViewProps) {
  const t = useTranslations('Contact');
  const current = useLocale();
  const locale = hasLocale(routing.locales, current) ? current : routing.defaultLocale;

  const all: { icon: keyof typeof iconPaths; label: string; value: string; href?: string }[] = [
    { icon: 'phone', label: t('phone'), value: settings.phone, href: `tel:${settings.phone.replace(/[^\d+]/g, '')}` },
    { icon: 'email', label: t('email'), value: settings.email, href: `mailto:${settings.email}` },
    { icon: 'address', label: t('address'), value: settings.address[locale] },
    { icon: 'hours', label: t('hours'), value: settings.workingHours[locale] },
  ];
  const rows = all.filter((row) => row.value.trim() !== '');

  return (
    <>
      <SectionTitle title={t('title')} level={1} />
      <Container>
        <div className="grid items-start gap-8 pb-[clamp(2.5rem,6vw,4.5rem)] lg:grid-cols-[1fr_2fr] lg:gap-[clamp(2rem,5vw,5rem)]">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">{t('introTitle')}</h2>
            <p className="mt-4 text-lg text-muted">{t('introText')}</p>
            {rows.length > 0 && (
              <address className="mt-6 flex flex-col gap-4 not-italic">
                {rows.map((row) => (
                  <div key={row.icon} className="flex items-start gap-4">
                    <span className="mt-2.5">
                      <Icon name={row.icon} />
                    </span>
                    <div className="min-w-0">
                      <span className="block text-xs font-medium tracking-wider text-muted uppercase">{row.label}</span>
                      {row.href ? (
                        <a
                          href={row.href}
                          className="flex min-h-touch items-center font-semibold break-words transition-colors duration-200 hover:text-accent-text"
                        >
                          {row.value}
                        </a>
                      ) : (
                        <span className="flex min-h-touch items-center font-semibold break-words">{row.value}</span>
                      )}
                    </div>
                  </div>
                ))}
              </address>
            )}
          </div>
          <ContactForm
            action={action}
            locale={locale}
            honeypotName={honeypotName}
            limits={limits}
            initialValues={product ? { subject: t('productSubject', product).slice(0, limits.subject) } : undefined}
            texts={{
              name: t('form.name'),
              email: t('form.email'),
              subject: t('form.subject'),
              message: t('form.message'),
              send: t('form.send'),
              sending: t('form.sending'),
              errors: { required: t('errors.required'), too_long: t('errors.too_long'), invalid: t('errors.invalid') },
              invalidSummary: t('invalidSummary'),
              rateLimited: t.raw('rateLimited'),
              okTitle: t('okTitle'),
              okText: t('okText'),
              demoTitle: t('demoTitle'),
              demoNote: t('demoNote'),
            }}
          />
        </div>
      </Container>
    </>
  );
}
