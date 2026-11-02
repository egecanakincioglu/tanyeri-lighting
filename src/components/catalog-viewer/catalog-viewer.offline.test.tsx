import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CatalogViewer } from './catalog-viewer.tsx';

vi.mock('./catalog-book.tsx', () => {
  throw new Error('chunk could not be fetched');
});

describe('CatalogViewer without its book chunk', () => {
  afterEach(cleanup);

  it('still offers the PDF itself', async () => {
    render(
      <CatalogViewer
        url="/demo/catalog-2026.pdf"
        name="Catalog 2026"
        onClose={() => {}}
        labels={{
          close: 'Close the catalog',
          previous: 'Previous page',
          next: 'Next page',
          page: 'Page {page} / {total}',
          pages: 'Pages {from}–{to} / {total}',
          loading: 'Opening the catalog…',
          error: 'This catalog cannot be shown here.',
          download: 'Download the PDF',
          book: 'Pages of {name}',
        }}
      />,
    );
    expect((await screen.findByRole('alert')).textContent).toBe('This catalog cannot be shown here.');
    expect(screen.getByRole('link', { name: 'Download the PDF' }).getAttribute('href')).toBe('/demo/catalog-2026.pdf');
    expect(screen.getByRole('button', { name: 'Close the catalog' })).toBeTruthy();
  });
});
