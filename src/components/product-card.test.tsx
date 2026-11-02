import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axeViolations } from '../test/axe.ts';
import { imageLoading } from '../test/image-loading.ts';
import { ProductCard } from './product-card.tsx';

const card = (
  <ProductCard
    imageUrl="/demo/product-gomme-spot.webp"
    name="Recessed spot 12W"
    href="/tr/products/spot"
    sizes="50vw"
  />
);

describe('ProductCard', () => {
  afterEach(cleanup);

  it('is one link named after the product', () => {
    render(card);
    const link = screen.getByRole('link', { name: 'Recessed spot 12W' });
    expect(link.getAttribute('href')).toBe('/tr/products/spot');
  });

  it('shows the whole photo, centred, in a square box with the given sizes', () => {
    const { container } = render(card);
    const box = container.querySelector('.aspect-square');
    expect(box?.className).toContain('[&_img]:object-contain');
    expect(box?.className).not.toContain('object-top');
    expect(container.querySelector('img')?.getAttribute('sizes')).toBe('50vw');
  });

  it('limits the name to two lines and applies the hover effect only with motion allowed', () => {
    const { container } = render(card);
    expect(screen.getByText('Recessed spot 12W').className).toContain('line-clamp-2');
    expect(container.firstElementChild?.className).toContain('motion-safe:hover:scale-105');
  });

  it('fetches the photo at once and ahead of the rest only when asked to', () => {
    const { container } = render(card);
    expect(imageLoading(container)).toEqual(['lazy/null']);
    cleanup();
    const eager = render(
      <ProductCard imageUrl="/demo/product-gomme-spot.webp" name="Spot" href="/tr/p" sizes="50vw" eager />,
    );
    expect(imageLoading(eager.container)).toEqual(['eager/high']);
  });

  it('has no axe violations', async () => {
    const { container } = render(<main>{card}</main>);
    expect(await axeViolations(container)).toEqual([]);
  });
});
