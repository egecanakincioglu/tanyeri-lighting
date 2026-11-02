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
  // The same fixed box as the artwork, so any proportions fit without moving the layout.
  if (uploaded) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={uploaded} width={width} height={height} alt={label} className="object-contain" />;
  }
  // A static file keeps the outlined lettering out of every HTML page.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={width} height={height} alt={label} />;
}
