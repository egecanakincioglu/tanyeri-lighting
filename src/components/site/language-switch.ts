// Finds the same page in another language from the address in the browser, without the routing code, so the menu's
// client script stays small. A route lists the full address of one page in every language, with `[name]` for a
// parameter; the server builds the list from the routing table.
export type SwitchRoute = Record<string, string>;

export const LOCALE_COOKIE = 'NEXT_LOCALE';

const PARAMETER = /\[([^\]]+)\]/g;

function matcher(template: string): RegExp {
  return new RegExp(`^${template.replace(PARAMETER, '([^/]+)')}$`);
}

function encodeSegment(segment: string): string {
  try {
    return encodeURIComponent(decodeURIComponent(segment));
  } catch {
    return segment;
  }
}

export function switchHref(pathname: string, from: string, to: string, routes: readonly SwitchRoute[]): string {
  const clean = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  for (const route of routes) {
    const source = route[from];
    const target = route[to];
    if (source === undefined || target === undefined) continue;
    const found = matcher(source).exec(clean);
    if (!found) continue;
    let index = 0;
    return target.replace(PARAMETER, () => encodeSegment(found[++index] ?? ''));
  }
  // An address no page answers keeps its path under the other language, as the not-found page does.
  return clean.startsWith(`/${from}`) ? `/${to}${clean.slice(from.length + 1)}` : `/${to}`;
}

export function rememberLocale(locale: string): void {
  document.cookie = `${LOCALE_COOKIE}=${locale};sameSite=lax;path=/;`;
}
