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

  it('declares the brand breakpoints and no default palette', () => {
    const css = readFileSync(globals, 'utf8');
    expect(css).toContain('--color-*: initial;');
    for (const [name, rem] of [
      ['xs', 33.75],
      ['sm', 37.5],
      ['mid', 40],
      ['md', 48],
      ['wide', 56.25],
      ['lg', 64],
      ['xl', 80],
      ['2xl', 90],
      ['3xl', 120],
      ['4xl', 150],
    ] as const) {
      expect(css).toContain(`--breakpoint-${name}: ${rem}rem;`);
    }
  });
});

const tokenNames = [
  'page',
  'surface',
  'ink',
  'muted',
  'accent',
  'accent-hover',
  'on-accent',
  'accent-text',
  'accent-tint',
  'hairline',
  'error',
  'success',
];

function colors(css: string): Record<string, string> {
  const block = css.slice(css.indexOf('@theme {'), css.indexOf('}', css.indexOf('@theme {')));
  return Object.fromEntries([...block.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6});/g)].map((m) => [m[1], m[2]]));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe('color tokens', () => {
  const css = readFileSync(globals, 'utf8');
  const palette = colors(css);

  it('defines every semantic color once, for the single light theme', () => {
    expect(Object.keys(palette).sort()).toEqual([...tokenNames].sort());
    expect(css).not.toContain('data-theme');
  });

  it('keeps text pairs at 4.5:1 or more', () => {
    for (const foreground of ['ink', 'muted', 'accent-text', 'error', 'success']) {
      for (const background of ['page', 'surface']) {
        expect(
          contrast(palette[foreground]!, palette[background]!),
          `${foreground} on ${background}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrast(palette['accent-text']!, palette['accent-tint']!)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the dark label on accent fills at 4.5:1 or more', () => {
    expect(contrast(palette['on-accent']!, palette['accent']!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette['on-accent']!, palette['accent-hover']!)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the accent fill visible against the surface at 3:1 or more', () => {
    expect(contrast(palette['accent']!, palette['surface']!)).toBeGreaterThanOrEqual(3);
  });
});

describe('sizing tokens', () => {
  const css = readFileSync(globals, 'utf8');

  it('declares a 44 px touch size', () => {
    expect(css).toContain('--spacing-touch: 2.75rem;');
  });

  it('widens the container on very wide screens', () => {
    expect(css).toContain('--container-page: 75rem;');
    for (const rem of [82, 90, 100]) expect(css).toContain(`--container-page: ${rem}rem;`);
  });
});
