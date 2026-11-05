import Link from 'next/link';
import { getPathname } from '../../i18n/navigation.ts';
import type { routing } from '../../i18n/routing.ts';
import type { ApplicationArea } from '../../server/content/schemas.ts';
import { Card, CARD_FRAME } from '../card.tsx';
import { Container } from '../container.tsx';
import { SectionTitle } from '../section-title.tsx';
import { SiteImage } from '../site-image.tsx';

type Locale = (typeof routing.locales)[number];

// 1 column below 600 px, 2 up to 900 px, then 3; the page width is fixed from 1440 px.
const sizes =
  '(min-width: 150rem) 515px, (min-width: 120rem) 461px, (min-width: 90rem) 419px, (min-width: 56.25rem) calc(30.7vw - 1.17rem), (min-width: 37.5rem) calc(46vw - 0.88rem), 92vw';

/** Renders nothing without areas. */
export function WorkAreas({ title, areas, locale }: { title: string; areas: ApplicationArea[]; locale: Locale }) {
  if (areas.length === 0) return null;

  return (
    <section aria-label={title} className="pb-[clamp(2.5rem,6vw,4.5rem)]">
      <SectionTitle title={title} level={2} />
      <Container>
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-7 wide:grid-cols-3">
          {areas.map((area) => (
            <li key={area.id} className="group relative h-full">
              <div className={CARD_FRAME}>
                <Card>
                  <div className="relative aspect-video flex-none overflow-hidden motion-safe:[&_img]:transition-transform motion-safe:[&_img]:duration-400 motion-safe:group-hover:[&_img]:scale-[1.08]">
                    <SiteImage src={area.imageUrl} alt={area.imageAlt[locale]} fill sizes={sizes} />
                  </div>
                  <div className="flex-1 px-4.5 pt-4 pb-5 sm:px-6 sm:pt-5 sm:pb-6">
                    <h3 className="mb-1.5 text-xl leading-tight text-ink">
                      {area.categoryKey ? (
                        <Link
                          href={getPathname({
                            locale,
                            href: { pathname: '/products', query: { category: area.categoryKey } },
                          })}
                          prefetch={false}
                          className="transition-colors duration-300 after:absolute after:inset-0 after:rounded-lg after:content-[''] group-hover:text-accent-text focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent-text"
                        >
                          {area.title[locale]}
                        </Link>
                      ) : (
                        area.title[locale]
                      )}
                    </h3>
                    <p className="text-[0.95rem] leading-relaxed text-muted sm:text-base">{area.description[locale]}</p>
                  </div>
                </Card>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
