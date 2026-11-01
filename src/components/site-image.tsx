import Image, { type ImageProps } from 'next/image';

/** Next.js makes `sizes` optional; here it is required so the browser never downloads the full source. */
type SiteImageProps = Omit<ImageProps, 'className' | 'style' | 'sizes'> & { sizes: string };

/** With `fill` the photo covers a sized parent box; otherwise it keeps its own ratio and never overflows. */
export function SiteImage({ alt, fill, ...rest }: SiteImageProps) {
  return <Image alt={alt} fill={fill} className={fill ? 'object-cover' : 'h-auto max-w-full'} {...rest} />;
}
