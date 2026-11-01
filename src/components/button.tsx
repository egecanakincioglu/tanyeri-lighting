import Link from 'next/link';
import type { ComponentProps } from 'react';

type Variant = 'primary' | 'outline' | 'ghost';

const base =
  'inline-flex min-h-touch min-w-touch items-center justify-center gap-2 rounded-md border px-5 text-[0.9375rem] font-semibold transition-colors duration-200';

const variants: Record<Variant, string> = {
  primary: 'border-accent bg-accent text-on-accent hover:border-accent-hover hover:bg-accent-hover',
  // The quiet choice next to a primary action, on a white surface.
  outline: 'border-hairline bg-surface text-ink hover:border-accent hover:text-accent-text',
  // For use on photos: a white outline over the image scrim.
  ghost: 'border-white/70 bg-transparent text-white hover:border-white hover:bg-white/15',
};

const disabledStyle = 'disabled:cursor-not-allowed disabled:border-hairline disabled:bg-surface disabled:text-muted';

type ButtonProps = Omit<ComponentProps<'button'>, 'className'> & { variant?: Variant };

export function Button({ variant = 'primary', type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={`${base} ${variants[variant]} ${disabledStyle}`} {...rest} />;
}

type ButtonLinkProps = Omit<ComponentProps<typeof Link>, 'className'> & { variant?: Variant };

/** A link that looks like a button, for navigation that is not an action. */
export function ButtonLink({ variant = 'primary', ...rest }: ButtonLinkProps) {
  return <Link className={`${base} ${variants[variant]}`} {...rest} />;
}
