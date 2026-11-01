type LogoProps = {
  /** Accessible name of the logo. */
  label: string;
  /** `header` is the two-word lockup; `full` adds the tagline. */
  variant?: 'header' | 'full';
  /** Size classes; the width and height attributes only reserve the aspect ratio. */
  className?: string;
};

const files = {
  header: { src: '/brand/logo-header.svg', width: 218, height: 41 },
  full: { src: '/brand/logo.svg', width: 232, height: 60 },
} as const;

export function Logo({ label, variant = 'header', className = 'h-10 w-auto' }: LogoProps) {
  const { src, width, height } = files[variant];
  // A static file keeps the outlined lettering out of every HTML page.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={width} height={height} alt={label} className={className} />;
}
