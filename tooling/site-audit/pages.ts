// Every public page the audit visits. A page template under src/app/[locale]/(site) without an address here fails
// pages.test.ts, so a new template can not ship unaudited.
export const LOCALES = ['tr', 'en'] as const;

export const PAGES: readonly string[] = ['/tr', '/en'];
