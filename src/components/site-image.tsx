import { getImageProps, type ImageProps } from 'next/image';

/** `sizes` is required so the browser never downloads the full source. */
type SiteImageProps = Omit<ImageProps, 'className' | 'style' | 'sizes'> & { sizes: string };

/** Must match `images.qualities` in the Next.js config. */
const PHOTO_QUALITY = 60;

// The image component's own script (about 6 KB) is not needed: the server decides the address, sizes and box.
export function SiteImage({ alt, fill, ...rest }: SiteImageProps) {
  const { props } = getImageProps({
    alt,
    fill,
    quality: PHOTO_QUALITY,
    className: fill ? 'object-cover' : 'h-auto max-w-full',
    ...rest,
  });
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} alt={alt} />;
}

export function eagerWhen(first: boolean) {
  return first ? ({ loading: 'eager', fetchPriority: 'high' } as const) : {};
}
