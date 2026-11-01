import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcDir = join(import.meta.dirname, '..');
const fontsDir = join(import.meta.dirname, 'fonts');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|css)$/.test(entry.name) && !entry.name.includes('.test.') ? [path] : [];
  });
}

describe('fonts', () => {
  const sources = sourceFiles(srcDir).map((file) => [file, readFileSync(file, 'utf8')] as const);

  it('are not fetched from the internet', () => {
    for (const [file, text] of sources) {
      expect(text, file).not.toMatch(/next\/font\/google/);
      expect(text, file).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
      expect(text, file).not.toMatch(/@import\s+url\(/);
    }
  });

  it('load with next/font/local only', () => {
    const layout = sources.find(([file]) => file.endsWith('layout.tsx') && file.includes('[locale]'));
    expect(layout?.[1]).toContain("from 'next/font/local'");
  });

  it('stay within the budget of two files and 100 KB', () => {
    const files = readdirSync(fontsDir).filter((name) => name.endsWith('.woff2'));
    const bytes = files.reduce((sum, name) => sum + statSync(join(fontsDir, name)).size, 0);
    expect(files).toHaveLength(2);
    expect(bytes).toBeLessThanOrEqual(100 * 1024);
  });

  it('ship with their license texts', () => {
    for (const name of ['OFL-Archivo.txt', 'OFL-IBMPlexMono.txt']) {
      expect(readFileSync(join(fontsDir, name), 'utf8')).toContain('SIL OPEN FONT LICENSE Version 1.1');
    }
  });
});
