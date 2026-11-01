import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axeViolations } from '../test/axe.ts';
import { Button, ButtonLink } from './button.tsx';

describe('Button', () => {
  afterEach(cleanup);

  it('renders a button that does not submit forms by default', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' }).getAttribute('type')).toBe('button');
  });

  it('fills the primary variant with the accent and dark text', () => {
    render(<Button>One</Button>);
    const { className } = screen.getByText('One');
    expect(className).toContain('bg-accent');
    expect(className).toContain('text-on-accent');
  });

  it('outlines the ghost variant in white', () => {
    render(<Button variant="ghost">Two</Button>);
    expect(screen.getByText('Two').className).toContain('border-white/70');
  });

  it('keeps a 44 px touch target', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button').className).toContain('min-h-touch');
  });

  it('can be disabled', () => {
    render(<Button disabled>Save</Button>);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('sets no style attribute', () => {
    const { container } = render(<Button>Save</Button>);
    expect(container.querySelector('[style]')).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <main>
        <h1>Title</h1>
        <Button>Save</Button>
        <Button disabled>Off</Button>
      </main>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('ButtonLink', () => {
  afterEach(cleanup);

  it('renders a link with the button look', () => {
    render(<ButtonLink href="/contact">Contact</ButtonLink>);
    const link = screen.getByRole('link', { name: 'Contact' });
    expect(link.getAttribute('href')).toBe('/contact');
    expect(link.className).toContain('min-h-touch');
    expect(link.className).toContain('bg-accent');
  });

  it('supports the ghost variant', () => {
    render(
      <ButtonLink href="/a" variant="ghost">
        A
      </ButtonLink>,
    );
    expect(screen.getByRole('link').className).toContain('border-white/70');
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <main>
        <h1>Title</h1>
        <ButtonLink href="/contact">Contact</ButtonLink>
      </main>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
