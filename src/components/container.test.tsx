import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axeViolations } from '../test/axe.ts';
import { Container } from './container.tsx';

describe('Container', () => {
  afterEach(cleanup);

  it('is centred and capped by the page width inside the gutters', () => {
    render(<Container data-testid="c">Inside</Container>);
    const { className } = screen.getByTestId('c');
    expect(className).toContain('mx-auto');
    expect(className).toContain('var(--gutter)');
    expect(className).toContain('var(--container-page)');
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <main>
        <h1>Title</h1>
        <Container>Inside</Container>
      </main>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
