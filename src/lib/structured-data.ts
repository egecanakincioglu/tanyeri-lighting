import type { Article, BreadcrumbList, ContactPage, Organization, Thing, WebSite, WithContext } from 'schema-dts';
import type { SiteSettings, SocialLink } from '../server/content/schemas.ts';
import { absoluteUrl, localizedPath, type Locale, type PageHref } from './seo.ts';

// `<` is escaped so data cannot close the script element.
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

// One site-wide node so the contact page can point at it.
export function organizationId(): string {
  return absoluteUrl('/#organization');
}

const trimmed = (value: string) => value.trim();

// Empty texts are left out.
const when = <K extends string>(key: K, value: string | undefined) =>
  (value ? { [key]: value } : {}) as { [P in K]?: string };

// schema-dts also allows a bare string; builders always return objects.
type Node<T extends Thing> = Exclude<WithContext<T>, string>;

export function websiteData(settings: SiteSettings, locale: Locale): Node<WebSite> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': absoluteUrl('/#website'),
    url: absoluteUrl(localizedPath(locale, '/')),
    name: trimmed(settings.siteName[locale]) || 'Tanyeri Lighting',
    inLanguage: locale,
    publisher: { '@id': organizationId() },
  };
}

const FALLBACK_LOGO = '/icons/icon-512.png';

// No address or business type: the brand is fictional.
// Demo contact data is not the brand's, so no contact point or sameAs.
export function organizationData(
  settings: SiteSettings,
  links: readonly SocialLink[],
  locale: Locale,
  { description, demo = false }: { description?: string; demo?: boolean } = {},
): Node<Organization> {
  const email = trimmed(settings.email);
  const telephone = trimmed(settings.phone);
  const sameAs = demo ? [] : links.map((link) => link.url);
  const contactPoint = {
    '@type': 'ContactPoint' as const,
    contactType: 'customer service',
    ...when('email', email),
    ...when('telephone', telephone),
    ...when('areaServed', trimmed(settings.serviceArea[locale])),
    ...when('availableLanguage', trimmed(settings.languages[locale])),
  };
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': organizationId(),
    name: trimmed(settings.siteName[locale]) || 'Tanyeri Lighting',
    url: absoluteUrl(localizedPath(locale, '/')),
    ...when('description', description),
    logo: absoluteUrl(settings.logoUrl || FALLBACK_LOGO),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(!demo && (email || telephone) ? { contactPoint } : {}),
  };
}

export type Crumb = { name: string; href: PageHref };

export function breadcrumbData(locale: Locale, crumbs: readonly Crumb[]): Node<BreadcrumbList> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem' as const,
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(localizedPath(locale, crumb.href)),
    })),
  };
}

export type ArticleFacts = {
  headline: string;
  description: string;
  image: string;
  published: Date;
  modified: Date;
  href: PageHref;
};

// The modified date comes from the saved row. The organization is author and publisher: articles have no named writer.
export function articleData(article: ArticleFacts, locale: Locale): Node<Article> {
  const url = absoluteUrl(localizedPath(locale, article.href));
  const modified = article.modified > article.published ? article.modified : article.published;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${url}#article`,
    mainEntityOfPage: url,
    headline: article.headline,
    description: article.description,
    image: absoluteUrl(article.image),
    datePublished: article.published.toISOString(),
    dateModified: modified.toISOString(),
    inLanguage: locale,
    author: { '@id': organizationId() },
    publisher: { '@id': organizationId() },
  };
}

export function contactPageData(name: string, locale: Locale): Node<ContactPage> {
  const url = absoluteUrl(localizedPath(locale, '/contact'));
  return {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    '@id': url,
    url,
    name,
    inLanguage: locale,
    about: { '@id': organizationId() },
  };
}
