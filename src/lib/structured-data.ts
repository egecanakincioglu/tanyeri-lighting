import type { Article, BreadcrumbList, ContactPage, Organization, Thing, WebSite, WithContext } from 'schema-dts';
import type { SiteSettings, SocialLink } from '../server/content/schemas.ts';
import { absoluteUrl, localizedPath, type Locale, type PageHref } from './seo.ts';

// The data is written inside a script element. `<` is escaped so no text in the data can close the element or open
// another one; JSON.parse reads the escaped form back to the same value.
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

// One node for the whole site, whatever the language, so the contact page can point at it.
export function organizationId(): string {
  return absoluteUrl('/#organization');
}

const trimmed = (value: string) => value.trim();

// A text the visitor can not see on the page is not written: empty ones are left out.
const when = <K extends string>(key: K, value: string | undefined) =>
  (value ? { [key]: value } : {}) as { [P in K]?: string };

// The schema-dts types also allow a bare string for a node; the builders always return the object form.
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

// A link to a placeholder address (example.com) is not a profile of the brand, so it is not claimed.
const isPlaceholderHost = (url: string) => {
  try {
    const host = new URL(url).hostname;
    return host === 'example.com' || host.endsWith('.example.com');
  } catch {
    return true;
  }
};

const FALLBACK_LOGO = '/icons/icon-512.png';

// No postal address and no business type: the brand is fictional and has no location. The description repeats the
// visible text of the page. In the demo the phone and email reach nobody, so no contact point is written.
export function organizationData(
  settings: SiteSettings,
  links: readonly SocialLink[],
  locale: Locale,
  { description, demo = false }: { description?: string; demo?: boolean } = {},
): Node<Organization> {
  const email = trimmed(settings.email);
  const telephone = trimmed(settings.phone);
  const sameAs = links.map((link) => link.url).filter((url) => !isPlaceholderHost(url));
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
  /** An address or a path on the site. */
  image: string;
  published: Date;
  modified: Date;
  href: PageHref;
};

// Every value is shown on the page (title, summary, picture, date) except the modified date, which the saved row
// carries. The organization is the author and the publisher: the articles have no named writer.
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
