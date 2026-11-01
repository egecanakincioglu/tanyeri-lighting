import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from './manifest.ts';

const publicDir = join(import.meta.dirname, '..', '..', 'public');
const globals = readFileSync(join(import.meta.dirname, 'globals.css'), 'utf8');

describe('web manifest', () => {
  const result = manifest();

  it('names the site and starts on the Turkish home page', () => {
    expect(result.name).toBe('Tanyeri Lighting');
    expect(result.short_name).toBe('Tanyeri');
    expect(result.start_url).toBe('/tr');
  });

  it('uses the accent and page colours of the design tokens', () => {
    expect(globals).toContain(`--color-accent: ${result.theme_color};`);
    expect(globals).toContain(`--color-page: ${result.background_color};`);
  });

  it('lists the 192 and 512 icons, which exist in public', () => {
    const icons = result.icons ?? [];
    expect(icons.map((icon) => icon.sizes)).toEqual(['192x192', '512x512']);
    for (const icon of icons) {
      expect(icon.src.startsWith('/')).toBe(true);
      expect(() => readFileSync(join(publicDir, icon.src))).not.toThrow();
    }
  });
});
