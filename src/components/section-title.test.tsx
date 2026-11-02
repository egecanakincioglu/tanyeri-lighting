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

  it('draws the background text from CSS, so the HTML holds it once and the accessibility tree skips it', () => {
    const { container } = render(<SectionTitle title="Products" level={2} />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.getAttribute('data-title')).toBe('Products');
    // The empty alternative after the slash keeps the generated text out of the accessibility tree.
    expect(wrapper?.className).toContain("before:content-[attr(data-title)_/_'']");
    expect(screen.getAllByText('Products')).toHaveLength(1);
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
