import Link from 'next/link';
import { Card } from '../card.tsx';
import { SiteImage, eagerWhen } from '../site-image.tsx';
import type { ReactNode } from 'react';

type Props = {
  title: string;
  excerpt: string;
  imageUrl: string;
  href: string;
  date: ReactNode;
  eager?: boolean;
};

// The demo photos are 480 px wide, so thumbnails are at most 192 px: sharp on 2x screens.
const IMAGE_SIZES = '(min-width: 40rem) 192px, 112px';

export function PostCard({ title, excerpt, imageUrl, href, date, eager = false }: Props) {
  return (
    <div className="relative h-full">
      <Card>
        <div className="flex items-start gap-4 p-3 sm:gap-6 sm:p-4">
          <span className="relative block aspect-square w-28 flex-none overflow-hidden rounded-md bg-page sm:w-48">
            <SiteImage src={imageUrl} alt="" fill sizes={IMAGE_SIZES} {...eagerWhen(eager)} />
          </span>
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm text-muted">{date}</p>
            <h2 className="text-lg leading-snug font-bold text-ink sm:text-xl">
              <Link
                href={href}
                prefetch={false}
                className="wrap-break-word after:absolute after:inset-0 after:content-[''] hover:text-accent-text"
              >
                {title}
              </Link>
            </h2>
            <p className="line-clamp-3 text-muted">{excerpt}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
