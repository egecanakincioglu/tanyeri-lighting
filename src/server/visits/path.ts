import { routing } from '../../i18n/routing.ts';

const MAX_PATH_LENGTH = 200;
const PARAMETER = '[A-Za-z0-9_-]+';

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toPattern(template: string): string {
  if (template === '/') return '';
  return template
    .split(/(\[[^\]]+\])/)
    .map((part) => (part.startsWith('[') ? PARAMETER : escape(part)))
    .join('');
}

// One pattern per public page and language, built from the routing table so a new page is counted without a change
// here. The admin section ("/dashboard...") is left out on purpose: the panel is never recorded.
const PATTERNS: readonly RegExp[] = Object.entries(routing.pathnames)
  .filter(([key]) => !key.startsWith('/dashboard'))
  .flatMap(([, value]) =>
    routing.locales.map(
      (locale) => new RegExp(`^/${locale}${toPattern(typeof value === 'string' ? value : value[locale])}$`),
    ),
  );

// True only for the address of a known public page, with its language prefix. Anything else (the panel, a 404, a long
// or odd string) is refused. The path is not stored; this only keeps forged requests out.
export function isVisitPath(text: string): boolean {
  if (text.length === 0 || text.length > MAX_PATH_LENGTH) return false;
  const path = text.length > 1 && text.endsWith('/') ? text.slice(0, -1) : text;
  return PATTERNS.some((pattern) => pattern.test(path));
}
