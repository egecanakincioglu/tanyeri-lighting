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

  it.each(['header', 'full'] as const)('reserves its aspect ratio with a fixed width and height as %s', (variant) => {
    render(<Logo label="Tanyeri Lighting" variant={variant} />);
    const img = screen.getByRole('img');
    expect(Number(img.getAttribute('width'))).toBeGreaterThan(0);
    expect(Number(img.getAttribute('height'))).toBeGreaterThan(0);
  });

  it('takes its size from the className prop and sets no style attribute', () => {
    const { container } = render(<Logo label="Tanyeri Lighting" className="h-6 w-auto" />);
    expect(container.querySelector('img')?.getAttribute('class')).toBe('h-6 w-auto');
    expect(container.querySelector('[style]')).toBeNull();
  });

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
