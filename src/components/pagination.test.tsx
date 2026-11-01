import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axeViolations } from '../test/axe.ts';
import { Pagination } from './pagination.tsx';

const items = [
  { label: '1', href: '/blog' },
  { label: '2', href: '/blog?page=2', current: true },
  { label: '3', href: '/blog?page=3' },
];

describe('Pagination', () => {
  afterEach(cleanup);

  it('is a named navigation landmark with one link per item', () => {
    render(<Pagination label="Pages" items={items} />);
    expect(screen.getByRole('navigation', { name: 'Pages' })).toBeTruthy();
    expect(screen.getAllByRole('link')).toHaveLength(3);
  });

  it('marks only the current page with aria-current', () => {
    render(<Pagination label="Pages" items={items} />);
    expect(screen.getByRole('link', { name: '2' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: '1' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('link', { name: '3' }).getAttribute('aria-current')).toBeNull();
  });

  it('fills the current page with the accent and leaves the others plain', () => {
    render(<Pagination label="Pages" items={items} />);
    const current = screen.getByRole('link', { name: '2' }).className;
    expect(current).toContain('bg-accent');
    expect(current).toContain('text-on-accent');
    expect(screen.getByRole('link', { name: '1' }).className).not.toContain('bg-accent');
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <main>
        <h1>Title</h1>
        <Pagination label="Pages" items={items} />
      </main>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
