import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axeViolations } from '../test/axe.ts';
import { Breadcrumb } from './breadcrumb.tsx';

afterEach(cleanup);

const items = [
  { name: 'Products', href: '/en/products' },
  { name: 'Pendants', href: '/en/products?category=sarkit' },
  { name: 'Ring Pendant' },
];

describe('Breadcrumb', () => {
  it('is a named landmark with one list item per step', () => {
    render(<Breadcrumb label="Breadcrumb" items={items} />);
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(
      within(nav)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Products', 'Pendants', 'Ring Pendant']);
  });

  it('links every step but the last, and marks the last as the current page', () => {
    render(<Breadcrumb label="Breadcrumb" items={items} />);
    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/en/products', '/en/products?category=sarkit']);
    expect(links.every((link) => link.getAttribute('aria-current') === null)).toBe(true);
    const current = screen.getByText('Ring Pendant').closest('[aria-current]');
    expect(current?.getAttribute('aria-current')).toBe('page');
    expect(screen.queryByRole('link', { name: 'Ring Pendant' })).toBeNull();
  });

  it('keeps a trail of one step as text', () => {
    render(<Breadcrumb label="Breadcrumb" items={[{ name: 'Products' }]} />);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByText('Products').closest('[aria-current]')?.getAttribute('aria-current')).toBe('page');
  });

  it('stays on one line and has no axe violations', async () => {
    const { container } = render(
      <main>
        <Breadcrumb label="Breadcrumb" items={items} />
      </main>,
    );
    expect(container.querySelector('ol')?.className).toContain('flex-nowrap');
    expect(await axeViolations(container)).toEqual([]);
  });
});
