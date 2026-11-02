import Image, { type ImageProps } from 'next/image';

/** Next.js makes `sizes` optional; here it is required so the browser never downloads the full source. */
type SiteImageProps = Omit<ImageProps, 'className' | 'style' | 'sizes'> & { sizes: string };

/** The one quality every photo is encoded at; it must match `images.qualities` in the Next.js config. */
const PHOTO_QUALITY = 60;

/** With `fill` the photo covers a sized parent box; otherwise it keeps its own ratio and never overflows. */
export function SiteImage({ alt, fill, ...rest }: SiteImageProps) {
  return (
    <Image
      alt={alt}
      fill={fill}
      quality={PHOTO_QUALITY}
      className={fill ? 'object-cover' : 'h-auto max-w-full'}
      {...rest}
    />
  );
}

/** For the first picture of a list, which is in view on load: fetched at once and ahead of the rest. */
export function eagerWhen(first: boolean) {
  return first ? ({ loading: 'eager', fetchPriority: 'high' } as const) : {};
}
