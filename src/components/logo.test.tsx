import { cleanup, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';
import { Logo } from './logo.tsx';

describe('Logo', () => {
  afterEach(cleanup);

  it('names the mark-only variant through the label prop', () => {
    render(<Logo label="Tanyeri" />);
    expect(screen.getByRole('img', { name: 'Tanyeri' })).toBeTruthy();
    expect(screen.queryByText('TANYERİ')).toBeNull();
  });

  it('shows the wordmark next to the mark with one accessible name', () => {
    render(<Logo label="Tanyeri ana sayfa" variant="wordmark" />);
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByRole('img', { name: 'Tanyeri ana sayfa' }).textContent).toBe('TANYERİ');
  });

  it('takes its size from the className prop', () => {
    const { container } = render(<Logo label="Tanyeri" className="size-4" />);
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('size-4');
  });

  it.each(['mark', 'wordmark'] as const)(
    'crops the %s viewBox to the drawing so its left edge is at x=0',
    (variant) => {
      const { container } = render(<Logo label="Tanyeri" variant={variant} />);
      expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('3 3 26 26');
    },
  );

  it('colors the mark from tokens and sets no style attribute', () => {
    const { container } = render(<Logo label="Tanyeri" variant="wordmark" />);
    expect(container.querySelector('.fill-brand-slab')).toBeTruthy();
    expect(container.querySelector('.fill-brand-beam')).toBeTruthy();
    expect(container.querySelector('[style]')).toBeNull();
  });

  it.each(['mark', 'wordmark'] as const)('has no axe violations as %s', async (variant) => {
    const { container } = render(
      <main>
        <h1>Page title</h1>
        <Logo label="Tanyeri" variant={variant} />
      </main>,
    );
    const { violations } = await axe.run(container);
    expect(violations).toEqual([]);
  });
});
