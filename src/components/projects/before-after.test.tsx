import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axeViolations } from '../../test/axe.ts';
import { imageLoading } from '../../test/image-loading.ts';
import { BeforeAfter } from './before-after.tsx';

const props = {
  beforeUrl: '/demo/project-konut-before.webp',
  afterUrl: '/demo/project-konut-after.webp',
  beforeLabel: 'Before',
  afterLabel: 'After',
  label: 'Compare before and after',
  valueText: '{before}% before, {after}% after',
  name: 'Housing',
  sizes: '30rem',
};

describe('BeforeAfter', () => {
  afterEach(cleanup);

  it('is a range input with a visible label, starting at the middle', () => {
    render(<BeforeAfter {...props} />);
    const slider = screen.getByRole('slider', { name: 'Compare before and after' }) as HTMLInputElement;
    expect(slider.type).toBe('range');
    expect(slider.value).toBe('50');
    expect(slider.min).toBe('0');
    expect(slider.max).toBe('100');
    expect(slider.getAttribute('aria-valuetext')).toBe('50% before, 50% after');
    expect(screen.getByText('Compare before and after').tagName).toBe('LABEL');
  });

  it('can be reached with the keyboard', () => {
    render(<BeforeAfter {...props} />);
    const slider = screen.getByRole('slider') as HTMLInputElement;
    expect(slider.disabled).toBe(false);
    expect(slider.getAttribute('tabindex')).toBeNull();
    slider.focus();
    expect(document.activeElement).toBe(slider);
  });

  it('follows the value in the spoken text and in the cut of the before photo', () => {
    const { container } = render(<BeforeAfter {...props} />);
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '30' } });
    expect(slider.getAttribute('aria-valuetext')).toBe('30% before, 70% after');
    expect(container.querySelector<HTMLElement>('[style*="clip-path"]')?.style.clipPath).toBe('inset(0 70% 0 0)');
    fireEvent.change(slider, { target: { value: '100' } });
    expect(slider.getAttribute('aria-valuetext')).toBe('100% before, 0% after');
  });

  it('describes both photos and gives both the sizes', () => {
    render(<BeforeAfter {...props} />);
    const images = screen.getAllByRole('img');
    expect(images.map((img) => img.getAttribute('alt'))).toEqual(['Housing, After', 'Housing, Before']);
    expect(images.every((img) => img.getAttribute('sizes') === '30rem')).toBe(true);
  });

  it('fetches both photos at once and ahead of the rest only when asked to', () => {
    const { container } = render(<BeforeAfter {...props} />);
    expect(imageLoading(container)).toEqual(['lazy/null', 'lazy/null']);
    cleanup();
    const eager = render(<BeforeAfter {...props} eager />);
    expect(imageLoading(eager.container)).toEqual(['eager/high', 'eager/high']);
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <main>
        <h1>Projects</h1>
        <BeforeAfter {...props} />
      </main>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
