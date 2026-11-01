import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axeViolations } from '../../test/axe.ts';
import { LegalView } from './legal-view.tsx';

describe('LegalView', () => {
  afterEach(cleanup);

  it('renders the title as the single h1 and the Markdown body below it', () => {
    render(<LegalView title="Privacy Policy" body={'## Data\n\nWe keep **little** data.\n\n- one\n- two'} />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Privacy Policy');
    expect(screen.getByRole('heading', { level: 2, name: 'Data' })).toBeTruthy();
    expect(screen.getByText('little').tagName).toBe('STRONG');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('keeps the body headings below the page heading even when the text uses h1', () => {
    render(<LegalView title="Terms" body={'# Inside\n\ntext'} />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 2, name: 'Inside' })).toBeTruthy();
  });

  it('drops raw HTML from the body', () => {
    const { container } = render(<LegalView title="Terms" body={'ok <script>alert(1)</script><b>x</b>'} />);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
  });

  it('renders only the title for an empty body', () => {
    const { container } = render(<LegalView title="Terms" body="" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Terms');
    expect(container.querySelectorAll('p, ul, ol, h2, h3')).toHaveLength(0);
  });

  it('has no accessibility violations, with content and empty', async () => {
    const { container, rerender } = render(<LegalView title="Terms" body={'## A\n\ntext with [a link](/contact)'} />);
    expect(await axeViolations(container)).toEqual([]);
    rerender(<LegalView title="Terms" body="" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
