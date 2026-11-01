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
      ['sm', 24.375],
      ['md', 48],
      ['lg', 64],
      ['xl', 90],
    ] as const) {
      expect(css).toContain(`--breakpoint-${name}: ${rem}rem;`);
    }
  });
});

const tokenNames = [
  'page',
  'surface',
  'text',
  'muted',
  'primary',
  'primary-hover',
  'hairline',
  'input-border',
  'error',
  'success',
  'brand-slab',
  'brand-beam',
];

function colors(css: string, opener: string): Record<string, string> {
  const start = css.indexOf(opener);
  const block = css.slice(start, css.indexOf('}', start));
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
  const dark = colors(css, '@theme {');
  const light = colors(css, "[data-theme='light']");

  it.each([
    ['dark', dark],
    ['light', light],
  ])('defines every semantic color for the %s theme', (_theme, palette) => {
    expect(Object.keys(palette).sort()).toEqual([...tokenNames].sort());
  });

  it.each([
    ['dark', dark],
    ['light', light],
  ])('keeps text pairs at 4.5:1 or more in the %s theme', (_theme, palette) => {
    for (const foreground of ['text', 'muted', 'primary', 'error']) {
      for (const background of ['page', 'surface']) {
        expect(
          contrast(palette[foreground]!, palette[background]!),
          `${foreground} on ${background}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrast(palette['page']!, palette['primary']!)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['dark', dark],
    ['light', light],
  ])('keeps interface pairs at 3:1 or more in the %s theme', (_theme, palette) => {
    expect(contrast(palette['input-border']!, palette['surface']!)).toBeGreaterThanOrEqual(3);
    expect(contrast(palette['input-border']!, palette['page']!)).toBeGreaterThanOrEqual(3);
    expect(contrast(palette['brand-beam']!, palette['page']!)).toBeGreaterThanOrEqual(3);
    expect(contrast(palette['brand-slab']!, palette['page']!)).toBeGreaterThanOrEqual(3);
  });

  it('measures the main dark pairs as the brand sheet states', () => {
    expect(contrast(dark['text']!, dark['page']!)).toBeCloseTo(15.75, 1);
    expect(contrast(dark['primary']!, dark['page']!)).toBeCloseTo(10.65, 1);
  });
});
