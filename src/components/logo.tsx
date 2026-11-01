type LogoProps = {
  /** Accessible name of the logo. */
  label: string;
  variant?: 'mark' | 'wordmark';
  /** Size classes for the mark. */
  className?: string;
};

function Mark({ className }: { className: string }) {
  return (
    <svg viewBox="3 3 26 26" aria-hidden="true" focusable="false" className={`shrink-0 ${className}`}>
      <rect x="3" y="3" width="26" height="6" className="fill-brand-slab" />
      <path d="M12 11H20L27 29H5Z" className="fill-brand-beam" />
    </svg>
  );
}

export function Logo({ label, variant = 'mark', className = 'size-6.5' }: LogoProps) {
  if (variant === 'mark') {
    return (
      <span role="img" aria-label={label} className="inline-flex">
        <Mark className={className} />
      </span>
    );
  }
  return (
    <span role="img" aria-label={label} className="inline-flex items-center gap-3">
      <Mark className={className} />
      <span aria-hidden="true" className="text-xl leading-none font-extrabold tracking-brand text-text">
        TANYERİ
      </span>
    </span>
  );
}
