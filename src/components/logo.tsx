import Image from 'next/image';

type LogoProps = {
  label: string;
  variant?: 'header' | 'full';
  src?: string | null | undefined;
};

// Width and height are the shown CSS size; each file is exactly twice that, so it stays sharp on dense screens.
const files = {
  header: { src: '/brand/logo-header.svg', width: 220, height: 44 },
  full: { src: '/brand/logo.svg', width: 280, height: 71 },
} as const;

export function Logo({ label, variant = 'header', src: uploaded }: LogoProps) {
  const { src, width, height } = files[variant];
  // Only the footer logo is below the fold; the header logo is part of the first view and stays eager.
  const lazy = variant === 'full' ? ({ loading: 'lazy' } as const) : {};
  // Same fixed box as the artwork, so any proportions fit without layout shift.
  // Goes through the image optimizer so the page policy allows it, at one or two times the box.
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
