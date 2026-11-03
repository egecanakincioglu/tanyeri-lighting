import { getPathname } from '../../i18n/navigation.ts';
import type { routing } from '../../i18n/routing.ts';
import type { HomeBanner, PageKey } from '../../server/content/schemas.ts';
import { ButtonLink } from '../button.tsx';
import { Container } from '../container.tsx';
import { SiteImage } from '../site-image.tsx';

type Locale = (typeof routing.locales)[number];

// The pages a banner button can open, as route keys.
const PAGE_ROUTES = {
  home: '/',
  products: '/products',
  catalogs: '/catalogs',
  services: '/services',
  projects: '/projects',
  blog: '/blog',
  references: '/references',
  about: '/about',
  vision: '/vision',
  contact: '/contact',
  privacy: '/privacy',
  terms: '/terms',
} as const satisfies Record<PageKey, string>;

const scrim =
  'bg-[linear-gradient(90deg,rgb(0_0_0/0.76),rgb(0_0_0/0.64))] md:bg-[linear-gradient(90deg,rgb(0_0_0/0.78),rgb(0_0_0/0.72)_62%,rgb(0_0_0/0))] 2xl:bg-[linear-gradient(90deg,rgb(0_0_0/0.78),rgb(0_0_0/0.7)_40%,rgb(0_0_0/0)_85%)]';

/** Full-width photo with the page's only h1, one sentence and two buttons. Renders nothing while the title is empty. */
export function Banner({ banner, locale }: { banner: HomeBanner; locale: Locale }) {
  const title = banner.title[locale];
  if (title === '') return null;

  return (
    <section
      aria-labelledby="home-title"
      className="relative flex h-[clamp(22rem,38vw,40rem)] items-center overflow-hidden bg-ink 2xl:h-[clamp(40rem,66vh,54rem)]"
    >
      {banner.imageUrl !== '' && (
        <div className="absolute inset-0 [&_img]:object-[50%_85%]">
          <SiteImage
            src={banner.imageUrl}
            alt={banner.imageAlt[locale]}
            fill
            loading="eager"
            fetchPriority="high"
            sizes="100vw"
          />
        </div>
      )}
      <div aria-hidden="true" className={`absolute inset-0 z-[1] ${scrim}`} />
      <Container>
        <div className="relative z-[2] max-w-[34rem] text-white">
          <h1 id="home-title" className="text-[length:clamp(1.75rem,3.4vw,2.75rem)] leading-[1.15] font-bold">
            {title}
          </h1>
          <p className="mt-3.5 text-[length:clamp(1rem,1.3vw,1.125rem)] leading-relaxed text-white/90">
            {banner.description[locale]}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink prefetch={false} href={getPathname({ locale, href: PAGE_ROUTES[banner.primaryAction.target] })}>
              {banner.primaryAction.label[locale]}
            </ButtonLink>
            <ButtonLink
              variant="ghost"
              prefetch={false}
              href={getPathname({ locale, href: PAGE_ROUTES[banner.secondaryAction.target] })}
            >
              {banner.secondaryAction.label[locale]}
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
