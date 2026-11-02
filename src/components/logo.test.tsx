import { cleanup, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Logo } from './logo.tsx';

const brandDir = join(import.meta.dirname, '..', '..', 'public', 'brand');

describe('Logo', () => {
  afterEach(cleanup);

  it('names the header lockup through the label prop', () => {
    render(<Logo label="Tanyeri Lighting" />);
    const img = screen.getByRole('img', { name: 'Tanyeri Lighting' });
    expect(img.getAttribute('src')).toBe('/brand/logo-header.svg');
  });

  it('shows the full lockup for the full variant', () => {
    render(<Logo label="Tanyeri Lighting" variant="full" />);
    expect(screen.getByRole('img', { name: 'Tanyeri Lighting' }).getAttribute('src')).toBe('/brand/logo.svg');
  });

  it.each([
    ['header', 220, 44],
    ['full', 280, 71],
  ] as const)('shows an uploaded logo in the fixed box of the %s variant', (variant, width, height) => {
    render(<Logo label="Tanyeri Lighting" variant={variant} src="/demo/area-otel.webp" />);
    const img = screen.getByRole('img', { name: 'Tanyeri Lighting' });
    // Served by the image optimizer on our own origin, with a file for one and two times the box.
    const src = new URL(img.getAttribute('src') ?? '', 'http://localhost');
    expect(src.pathname).toBe('/_next/image');
    expect(src.searchParams.get('url')).toBe('/demo/area-otel.webp');
    expect(img.getAttribute('srcset')).toMatch(/ 1x, .* 2x$/);
    expect(img.getAttribute('width')).toBe(String(width));
    expect(img.getAttribute('height')).toBe(String(height));
    expect(img.getAttribute('class')).toBe('object-contain');
  });

  it('falls back to the artwork when the uploaded logo is empty', () => {
    render(<Logo label="Tanyeri Lighting" src={null} />);
    expect(screen.getByRole('img').getAttribute('src')).toBe('/brand/logo-header.svg');
  });

  it.each([
    ['header', 'logo-header.svg', 220, 44],
    ['full', 'logo.svg', 280, 71],
  ] as const)(
    'sets the on-screen size as %s and matches the file at twice that size',
    (variant, file, width, height) => {
      const { container } = render(<Logo label="Tanyeri Lighting" variant={variant} />);
      const img = screen.getByRole('img');
      expect(img.getAttribute('width')).toBe(String(width));
      expect(img.getAttribute('height')).toBe(String(height));
      // Fixed attributes with no class or style leave nothing for a flex-col parent to stretch.
      expect(img.getAttribute('class')).toBeNull();
      expect(container.querySelector('[style]')).toBeNull();
      const svg = readFileSync(join(brandDir, file), 'utf8');
      expect(svg).toContain(`width="${width * 2}" height="${height * 2}" viewBox=`);
    },
  );

  it.each(['logo-header.svg', 'logo.svg'])(
    'ships %s as outlined paths without scripts, comments or metadata',
    (file) => {
      const svg = readFileSync(join(brandDir, file), 'utf8');
      expect(svg).toContain('<path');
      expect(svg).not.toMatch(/<(script|text|metadata|title)|<!--|inkscape|sodipodi/i);
    },
  );

  it.each(['header', 'full'] as const)('has no axe violations as %s', async (variant) => {
    const { container } = render(
      <main>
        <h1>Page title</h1>
        <Logo label="Tanyeri Lighting" variant={variant} />
      </main>,
    );
    const { violations } = await axe.run(container);
    expect(violations).toEqual([]);
  });
});
