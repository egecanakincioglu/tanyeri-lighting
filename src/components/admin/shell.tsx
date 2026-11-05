import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { Link } from '../../i18n/navigation.ts';
import { Logo } from '../logo.tsx';

type ShellProps = {
  locale: string;
  logoLabel: string;
  backLabel: string;
  children: ReactNode;
};

/** The admin client components read the language from this provider; the public site has none. */
export function AdminShell({ locale, logoLabel, backLabel, children }: ShellProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={null}>
      <div className="flex min-h-svh flex-col items-center gap-8 bg-page px-(--gutter) py-10">
        <header>
          <Link href="/" prefetch={false} className="inline-flex min-h-touch items-center">
            <Logo label={logoLabel} />
          </Link>
        </header>
        <main id="main" tabIndex={-1} className="w-full max-w-md focus:outline-none">
          <div className="rounded-lg border border-hairline bg-surface p-6 shadow-sm sm:p-8">{children}</div>
        </main>
        <footer>
          <Link
            href="/"
            prefetch={false}
            className="inline-flex min-h-touch items-center text-sm text-muted hover:text-ink hover:underline"
          >
            {backLabel}
          </Link>
        </footer>
      </div>
    </NextIntlClientProvider>
  );
}
