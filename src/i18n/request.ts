import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { locale } from 'next/root-params';
import { routing } from './routing.ts';

export default getRequestConfig(async () => {
  const requested = await locale();
  const resolved = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale: resolved,
    messages: (await import(`../../messages/${resolved}.json`)).default,
  };
});
