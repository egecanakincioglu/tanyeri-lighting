import Image from 'next/image';

type LogoProps = {
  /** Accessible name of the logo. */
  label: string;
  /** `header` is the two-word lockup; `full` adds the tagline. */
  variant?: 'header' | 'full';
  /** An uploaded logo; the static artwork is used when it is missing. */
  src?: string | null | undefined;
};

// The width and height attributes are the on-screen size in CSS pixels. Each
// file declares exactly twice that size, so it stays sharp on dense screens
// without being larger than the image audit allows.
const files = {
  header: { src: '/brand/logo-header.svg', width: 220, height: 44 },
  full: { src: '/brand/logo.svg', width: 280, height: 71 },
} as const;

export function Logo({ label, variant = 'header', src: uploaded }: LogoProps) {
  const { src, width, height } = files[variant];
  // Only the footer logo is below the fold; the header logo is part of the first view and stays eager.
  const lazy = variant === 'full' ? ({ loading: 'lazy' } as const) : {};
  // The same fixed box as the artwork, so any proportions fit without moving the layout. The picture goes through the
  // image optimizer, so the browser loads it from our own origin (the page policy allows no other image host) and at
  // one or two times the box, which the image audit expects.
  if (uploaded) {
    return (
      <Image
        src={uploaded}
        width={width}
        height={height}
        quality={60}
        alt={label}
        className="object-contain"
        loading={variant === 'full' ? 'lazy' : 'eager'}
      />
    );
  }
  // A static file keeps the outlined lettering out of every HTML page.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={width} height={height} alt={label} {...lazy} />;
}
