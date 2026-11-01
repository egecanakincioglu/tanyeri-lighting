import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axeViolations } from '../test/axe.ts';
import { Card } from './card.tsx';

describe('Card', () => {
  afterEach(cleanup);

  it('renders an article with its children', () => {
    render(
      <Card aria-label="Item">
        <p>Body</p>
      </Card>,
    );
    expect(screen.getByRole('article', { name: 'Item' }).textContent).toBe('Body');
  });

  it('uses surface tokens and sets no style attribute', () => {
    const { container } = render(<Card>x</Card>);
    expect(container.querySelector('.bg-surface.border-hairline.overflow-hidden')).toBeTruthy();
    expect(container.querySelector('[style]')).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <main>
        <h1>Title</h1>
        <Card>
          <h2>Item</h2>
          <p>Body</p>
        </Card>
      </main>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
