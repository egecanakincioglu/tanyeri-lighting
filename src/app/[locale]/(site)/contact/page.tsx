import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { JsonLd } from '../../../../components/json-ld.tsx';
import { ContactView } from '../../../../components/site/contact-view.tsx';
import { routing } from '../../../../i18n/routing.ts';
import { toMetadata } from '../../../../lib/page-metadata.ts';
import { pageAlternates } from '../../../../lib/seo.ts';
import { breadcrumbData, contactPageData } from '../../../../lib/structured-data.ts';
import { submitContactMessage } from '../../../../server/contact/actions.ts';
import { HONEYPOT_FIELD, MAX_LENGTH } from '../../../../server/contact/form.ts';
import { findEnquiryProduct } from '../../../../server/contact/product-enquiry.ts';
import { getPageMetadata } from '../../../../server/content/page-metadata.ts';
import { getSiteSettings } from '../../../../server/content/site-settings.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/contact'>): Promise<Metadata> {
  const { locale } = await params;
  const pageLocale = hasLocale(routing.locales, locale) ? locale : 'tr';
  return {
    ...toMetadata(await getPageMetadata('contact'), pageLocale),
    alternates: pageAlternates(pageLocale, '/contact'),
  };
}

export default async function ContactPage({ params, searchParams }: PageProps<'/[locale]/contact'>) {
  const { locale } = await params;
  const pageLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const [header, settings, product] = await Promise.all([
    getTranslations({ locale: pageLocale, namespace: 'Header' }),
    getSiteSettings(),
    findEnquiryProduct((await searchParams).product, pageLocale),
  ]);
  return (
    <>
      <JsonLd data={contactPageData(header('contact'), pageLocale)} />
      <JsonLd
        data={breadcrumbData(pageLocale, [
          { name: header('home'), href: '/' },
          { name: header('contact'), href: '/contact' },
        ])}
      />
      <ContactView
        settings={settings}
        action={submitContactMessage}
        honeypotName={HONEYPOT_FIELD}
        limits={MAX_LENGTH}
        product={product ?? undefined}
      />
    </>
  );
}
