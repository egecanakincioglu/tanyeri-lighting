import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcDir = join(import.meta.dirname, '..');
const globals = join(srcDir, 'app', 'globals.css');

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(path);
    return entry.name.endsWith('.css') ? [path] : [];
  });
}

describe('stylesheets', () => {
  it('imports Tailwind from globals.css', () => {
    expect(readFileSync(globals, 'utf8')).toMatch(/@import\s+["']tailwindcss["']/);
  });

  it('keeps the @theme block only in globals.css', () => {
    const withTheme = cssFiles(srcDir).filter((file) => /@theme\b/.test(readFileSync(file, 'utf8')));
    expect(withTheme).toEqual([globals]);
  });
});
