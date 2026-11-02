import Link from 'next/link';
import { Card } from './card.tsx';
import { SiteImage } from './site-image.tsx';

type ProductCardProps = {
  imageUrl: string;
  name: string;
  href: string;
  /** Depends on how many columns the page lays the cards in. */
  sizes: string;
};

/** A square product photo, shown whole and centred, with its name below; the whole card is one link. */
export function ProductCard({ imageUrl, name, href, sizes }: ProductCardProps) {
  return (
    <div className="h-full rounded-lg duration-300 motion-safe:transition-[scale,box-shadow] motion-safe:hover:scale-105 motion-safe:hover:shadow-[0_8px_16px_rgb(0_0_0/0.12)] motion-safe:hover:[&>article]:shadow-none">
      <Card>
        <Link href={href} prefetch={false} className="flex h-full flex-col items-center p-3 text-center">
          <span className="relative block aspect-square w-full flex-none overflow-hidden rounded-md [&_img]:object-contain">
            <SiteImage src={imageUrl} alt="" fill sizes={sizes} />
          </span>
          <span className="mt-2.5 line-clamp-2 text-[0.9375rem] leading-snug font-bold text-ink">{name}</span>
        </Link>
      </Card>
    </div>
  );
}
