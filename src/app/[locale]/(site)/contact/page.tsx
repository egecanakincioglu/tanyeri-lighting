import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { ContactView } from '../../../../components/site/contact-view.tsx';
import { routing } from '../../../../i18n/routing.ts';
import { toMetadata } from '../../../../lib/page-metadata.ts';
import { submitContactMessage } from '../../../../server/contact/actions.ts';
import { HONEYPOT_FIELD, MAX_LENGTH } from '../../../../server/contact/form.ts';
import { findEnquiryProduct } from '../../../../server/contact/product-enquiry.ts';
import { getPageMetadata } from '../../../../server/content/page-metadata.ts';
import { getSiteSettings } from '../../../../server/content/site-settings.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/contact'>): Promise<Metadata> {
  const { locale } = await params;
  return toMetadata(await getPageMetadata('contact'), hasLocale(routing.locales, locale) ? locale : 'tr');
}

export default async function ContactPage({ params, searchParams }: PageProps<'/[locale]/contact'>) {
  const { locale } = await params;
  const pageLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const [settings, product] = await Promise.all([
    getSiteSettings(),
    findEnquiryProduct((await searchParams).product, pageLocale),
  ]);
  return (
    <ContactView
      settings={settings}
      action={submitContactMessage}
      honeypotName={HONEYPOT_FIELD}
      limits={MAX_LENGTH}
      product={product ?? undefined}
    />
  );
}
