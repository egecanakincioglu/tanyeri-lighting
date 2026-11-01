import type { routing } from '../../i18n/routing.ts';
import type { ApplicationArea } from '../../server/content/schemas.ts';
import { Card } from '../card.tsx';
import { Container } from '../container.tsx';
import { SectionTitle } from '../section-title.tsx';
import { SiteImage } from '../site-image.tsx';

type Locale = (typeof routing.locales)[number];

// 1 column below 600 px, 2 up to 900 px, then 3; the page width is fixed from 1440 px.
const sizes =
  '(min-width: 150rem) 515px, (min-width: 120rem) 461px, (min-width: 90rem) 419px, (min-width: 56.25rem) calc(30.7vw - 1.17rem), (min-width: 37.5rem) calc(46vw - 0.88rem), 92vw';

/** Cards with a 16:9 photo, a title and a short text. Renders nothing without areas. */
export function WorkAreas({ title, areas, locale }: { title: string; areas: ApplicationArea[]; locale: Locale }) {
  if (areas.length === 0) return null;

  return (
    <section aria-label={title} className="pb-[clamp(2.5rem,6vw,4.5rem)]">
      <SectionTitle title={title} level={2} />
      <Container>
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-7 wide:grid-cols-3">
          {areas.map((area) => (
            <li key={area.id} className="group h-full">
              <div className="h-full rounded-lg duration-300 motion-safe:transition-shadow motion-safe:hover:shadow-[0_8px_16px_rgb(0_0_0/0.12)] motion-safe:hover:[&>article]:shadow-none">
                <Card>
                  <div className="relative aspect-video flex-none overflow-hidden motion-safe:[&_img]:transition-transform motion-safe:[&_img]:duration-400 motion-safe:group-hover:[&_img]:scale-[1.08]">
                    <SiteImage src={area.imageUrl} alt="" fill sizes={sizes} />
                  </div>
                  <div className="flex-1 px-4.5 pt-4 pb-5 sm:px-6 sm:pt-5 sm:pb-6">
                    <h3 className="mb-1.5 text-xl leading-tight text-ink">{area.title[locale]}</h3>
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
