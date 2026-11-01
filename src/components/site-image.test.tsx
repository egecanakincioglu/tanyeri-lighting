import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axeViolations } from '../test/axe.ts';
import { SiteImage } from './site-image.tsx';

describe('SiteImage', () => {
  afterEach(cleanup);

  it('renders the alt text, sizes and a responsive srcset', () => {
    render(<SiteImage src="/photo.jpg" alt="A lamp" width={800} height={600} sizes="(min-width: 64rem) 50vw, 100vw" />);
    const img = screen.getByRole('img', { name: 'A lamp' });
    expect(img.getAttribute('sizes')).toBe('(min-width: 64rem) 50vw, 100vw');
    expect(img.getAttribute('srcset')).toBeTruthy();
  });

  it('keeps its ratio and never overflows its container', () => {
    render(<SiteImage src="/photo.jpg" alt="A lamp" width={800} height={600} sizes="100vw" />);
    const { className } = screen.getByRole('img');
    expect(className).toContain('max-w-full');
    expect(className).toContain('h-auto');
  });

  it('covers a sized box with fill and does not force an automatic height', () => {
    render(<SiteImage src="/photo.jpg" alt="A lamp" fill sizes="100vw" />);
    const { className } = screen.getByRole('img');
    expect(className).toContain('object-cover');
    expect(className).not.toContain('h-auto');
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <main>
        <h1>Title</h1>
        <SiteImage src="/photo.jpg" alt="A lamp" width={800} height={600} sizes="100vw" />
      </main>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
