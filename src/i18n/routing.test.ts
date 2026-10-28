import { describe, expect, it } from 'vitest';
import { routing } from './routing.ts';

describe('routing', () => {
  it('uses tr as the default language with an always-present prefix', () => {
    expect(routing.defaultLocale).toBe('tr');
    expect(routing.localePrefix).toBe('always');
  });

  it('defines every internal path for every language', () => {
    for (const [path, localized] of Object.entries(routing.pathnames)) {
      if (typeof localized === 'string') {
        expect(localized, path).toMatch(/^\//);
        continue;
      }
      for (const locale of routing.locales) {
        expect(localized[locale], `${path} (${locale})`).toMatch(/^\//);
      }
    }
  });
});
