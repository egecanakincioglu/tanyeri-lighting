import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axeViolations } from '../test/axe.ts';
import { SectionTitle } from './section-title.tsx';

describe('SectionTitle', () => {
  afterEach(cleanup);

  it.each([1, 2] as const)('renders level %i as the matching heading', (level) => {
    render(<SectionTitle title="Products" level={level} />);
    expect(screen.getByRole('heading', { level, name: 'Products' })).toBeTruthy();
  });

  it('hides the repeated background text from assistive technology', () => {
    const { container } = render(<SectionTitle title="Products" level={2} />);
    const ghost = container.querySelector('span[aria-hidden="true"]');
    expect(ghost?.textContent).toBe('Products');
    expect(screen.getAllByText('Products')).toHaveLength(2);
    expect(screen.getAllByRole('heading')).toHaveLength(1);
  });

  it('draws the accent line and sets no style attribute', () => {
    const { container } = render(<SectionTitle title="Products" level={2} />);
    expect(screen.getByRole('heading').className).toContain('after:bg-accent');
    expect(container.querySelector('[style]')).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <main>
        <SectionTitle title="Home" level={1} />
        <SectionTitle title="Products" level={2} />
      </main>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
