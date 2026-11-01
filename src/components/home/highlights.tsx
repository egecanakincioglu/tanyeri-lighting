import Link from 'next/link';
import { getPathname } from '../../i18n/navigation.ts';
import type { routing } from '../../i18n/routing.ts';
import type { Product, PromoBoard } from '../../server/content/schemas.ts';
import { Container } from '../container.tsx';
import { ProductCard } from '../product-card.tsx';
import { SectionTitle } from '../section-title.tsx';
import { SiteImage } from '../site-image.tsx';

type Locale = (typeof routing.locales)[number];

// Image widths follow the grid: 2 columns on phones, 6 from 640 px (boards span 2 columns, products 2 then 1), and a
// fixed page width from 1440 px. Product sizes are the cell widths minus the card padding.
const boardSizes =
  '(min-width: 150rem) 520px, (min-width: 120rem) 467px, (min-width: 90rem) 424px, (min-width: 40rem) calc(30.7vw - 0.83rem), 92vw';
const productSizes =
  '(min-width: 150rem) 226px, (min-width: 120rem) 199px, (min-width: 90rem) 178px, (min-width: 64rem) calc(15.3vw - 2.6rem), (min-width: 40rem) calc(30.7vw - 2.4rem), calc(46vw - 2rem)';

type HighlightsProps = {
  title: string;
  boardLabel: string;
  boards: PromoBoard[];
  products: Product[];
  locale: Locale;
};

function Board({ board, label, locale }: { board: PromoBoard; label: string; locale: Locale }) {
  const title = board.title[locale];
  return (
    <article className="relative col-span-2 flex min-h-36 items-end overflow-hidden rounded-lg bg-ink duration-300 mid:min-h-48 lg:aspect-[562/269] lg:min-h-0 hover:shadow-lg motion-safe:transition-[scale,rotate,opacity,box-shadow] motion-safe:hover:scale-105 motion-safe:hover:-rotate-3 motion-safe:hover:opacity-90">
      <SiteImage src={board.imageUrl} alt="" fill sizes={boardSizes} />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(0deg,rgb(0_0_0/0.82),rgb(0_0_0/0.6)_45%,rgb(0_0_0/0.2))]"
      />
      <div className="relative w-full px-4 py-3.5 text-white xl:px-6 xl:py-5">
        <h3 className="text-lg leading-tight font-bold xl:text-[1.375rem]">{title}</h3>
        <Link
          href={getPathname({ locale, href: '/catalogs' })}
          prefetch={false}
          className="group/more mt-0.5 inline-flex min-h-touch items-center gap-1.5 text-[0.9375rem] font-semibold after:absolute after:inset-0 after:content-[''] hover:underline hover:underline-offset-4"
        >
          {label}
          <span aria-hidden="true" className="transition-transform duration-200 group-hover/more:translate-x-0.75">
            →
          </span>
          <span className="sr-only">: {title}</span>
        </Link>
      </div>
    </article>
  );
}

/** One grid: the promo boards (3 wide cells), then the featured products. Renders nothing when both are empty. */
export function Highlights({ title, boardLabel, boards, products, locale }: HighlightsProps) {
  if (boards.length === 0 && products.length === 0) return null;

  return (
    <section aria-label={title}>
      <SectionTitle title={title} level={2} />
      <Container>
        <div className="grid grid-cols-2 gap-4 mid:grid-cols-6 mid:gap-5">
          {boards.map((board) => (
            <Board key={board.id} board={board} label={boardLabel} locale={locale} />
          ))}
          {products.map((product) => (
            <div key={product.id} className="mid:col-span-2 lg:col-span-1">
              <ProductCard
                imageUrl={product.imageUrl}
                name={product.name[locale]}
                href={getPathname({ locale, href: { pathname: '/products/[slug]', params: { slug: product.slug } } })}
                sizes={productSizes}
              />
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
