import { hasLocale } from 'next-intl';
import { getPathname } from '../../i18n/navigation.ts';
import { routing } from '../../i18n/routing.ts';

// The locale comes from the URL or a form, so an unknown value falls back to the default.
// Redirect targets are never taken from the request.
export function safeLocale(value: unknown): (typeof routing.locales)[number] {
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}

export function signInPath(locale: string): string {
  return getPathname({ locale: safeLocale(locale), href: '/dashboard/sign-in' });
}

export function panelPath(locale: string): string {
  return getPathname({ locale: safeLocale(locale), href: '/dashboard' });
}
