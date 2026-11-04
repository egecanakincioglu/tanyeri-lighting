import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../test/axe.ts';
import { CatalogView } from './catalog-view.tsx';
import type { ViewerLabels } from './viewer-labels.ts';

type BookProps = {
  width: number;
  height: number;
  startPage: number;
  usePortrait: boolean;
  flippingTime: number;
  showPageCorners: boolean;
  onFlip: (event: { data: number }) => void;
  children: unknown;
};

const lib = vi.hoisted(() => ({
  getDocument: vi.fn(),
  createWorker: vi.fn(),
  getPage: vi.fn(),
  render: vi.fn(),
  cancel: vi.fn(),
  destroyDocument: vi.fn(),
  destroyWorker: vi.fn(),
  terminate: vi.fn(),
  flipNext: vi.fn(),
  flipPrev: vi.fn(),
  book: { props: null as BookProps | null },
}));

vi.mock('pdfjs-dist', () => ({ PDFWorker: { create: lib.createWorker }, getDocument: lib.getDocument }));

vi.mock('react-pageflip', async () => {
  const React = await import('react');
  const Book = React.forwardRef(function Book(props: BookProps, ref) {
    React.useEffect(() => {
      lib.book.props = props;
    });
    React.useImperativeHandle(ref, () => ({ pageFlip: () => ({ flipNext: lib.flipNext, flipPrev: lib.flipPrev }) }));
    return React.createElement('div', { 'data-testid': 'book' }, props.children as never);
  });
  return { default: Book };
});

const labels: ViewerLabels = {
  close: 'Close the catalog',
  previous: 'Previous page',
  next: 'Next page',
  page: 'Page {page} / {total}',
  pages: 'Pages {from}–{to} / {total}',
  loading: 'Opening the catalog…',
  error: 'This catalog cannot be shown here.',
  download: 'Download the PDF',
  book: 'Pages of {name}',
};

const stage = vi.hoisted(() => ({ width: 400, height: 600 }));

class FakeResizeObserver {
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe() {
    const contentRect = { width: stage.width, height: stage.height } as DOMRectReadOnly;
    this.callback([{ contentRect } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  disconnect() {}
  unobserve() {}
}

function mockPdf(pageCount = 8) {
  lib.getDocument.mockImplementation(() => ({
    promise: Promise.resolve({ numPages: pageCount, getPage: lib.getPage }),
    destroy: lib.destroyDocument,
  }));
}

function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reduce && query.includes('reduce'),
      addEventListener() {},
      removeEventListener() {},
    })),
  );
}

const Plain = ({ children }: { children?: ReactNode }): ReactNode => children;

function renderView(Root: (props: { children?: ReactNode }) => ReactNode = Plain) {
  return render(
    <Root>
      <main>
        <h1>Catalogs</h1>
        <CatalogView
          href="/demo/catalog-2026.pdf"
          name="Catalog 2026"
          detail="PDF, 2.4 MB"
          label="View Catalog 2026 (PDF, opens in a new tab)"
          labels={labels}
          cover={<span data-testid="cover">Cover</span>}
          download={
            <a href="/demo/catalog-2026.pdf" download>
              Download
            </a>
          }
        >
          View
        </CatalogView>
      </main>
    </Root>,
  );
}

const viewLink = () => screen.getByRole('link', { name: /^View Catalog 2026/ });

async function openViewer() {
  fireEvent.click(viewLink());
  await screen.findByRole('dialog', { name: 'Catalog 2026' });
  await screen.findByText('Page 1 / 8');
}

const flipTo = (index: number) => act(() => lib.book.props?.onFlip({ data: index }));

describe('CatalogView', () => {
  beforeEach(() => {
    for (const mock of Object.values(lib)) if (typeof mock === 'function') mock.mockClear();
    lib.book.props = null;
    stage.width = 400;
    stage.height = 600;
    mockPdf();
    lib.createWorker.mockImplementation(() => ({ destroy: lib.destroyWorker }));
    lib.getPage.mockImplementation(() =>
      Promise.resolve({
        getViewport: ({ scale }: { scale: number }) => ({ width: 210 * scale, height: 297 * scale }),
        render: lib.render,
      }),
    );
    lib.render.mockImplementation(() => ({ promise: Promise.resolve(), cancel: lib.cancel }));
    mockReducedMotion(false);
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    vi.stubGlobal(
      'Worker',
      class {
        terminate = lib.terminate;
      },
    );
    vi.stubGlobal('devicePixelRatio', 1);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute('style');
  });

  it('keeps a real link to the PDF that opens in a new tab', () => {
    renderView();
    const link = viewLink();
    expect(link.getAttribute('href')).toBe('/demo/catalog-2026.pdf');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(lib.getDocument).not.toHaveBeenCalled();
  });

  it('shows the name, the size line, the cover and the download link in one card', () => {
    renderView();
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Catalog 2026');
    expect(screen.getByText('PDF, 2.4 MB')).toBeTruthy();
    expect(screen.getByTestId('cover')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Download' })).toBeTruthy();
  });

  it('opens the viewer from the cover, which is a link to the PDF but no second tab stop', async () => {
    renderView();
    const cover = screen.getByTestId('cover').closest('a');
    expect(cover?.getAttribute('href')).toBe('/demo/catalog-2026.pdf');
    expect(cover?.getAttribute('tabindex')).toBe('-1');
    expect(cover?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getAllByRole('link', { name: /Catalog 2026/ })).toHaveLength(1);
    fireEvent.click(cover as HTMLElement);
    await screen.findByRole('dialog', { name: 'Catalog 2026' });
    await screen.findByText('Page 1 / 8');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(viewLink());
  });

  it('leaves new-tab clicks on the cover to the browser', () => {
    renderView();
    fireEvent.click(screen.getByTestId('cover'), { ctrlKey: true });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('leaves new-tab clicks to the browser', () => {
    renderView();
    fireEvent.click(viewLink(), { ctrlKey: true });
    fireEvent.click(viewLink(), { button: 1 });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens a dialog titled with the catalog name and moves focus to the close button', async () => {
    renderView();
    await openViewer();
    const dialog = screen.getByRole('dialog', { name: 'Catalog 2026' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(within(dialog).getByRole('heading', { name: 'Catalog 2026' })).toBeTruthy();
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Close the catalog' }));
    expect(lib.getDocument).toHaveBeenCalledWith(expect.objectContaining({ url: '/demo/catalog-2026.pdf' }));
  });

  it('makes the page behind inert and locks scrolling while it is open', async () => {
    renderView();
    const behind = screen.getByRole('main', { hidden: true }).parentElement;
    await openViewer();
    expect(behind?.hasAttribute('inert')).toBe(true);
    expect(document.documentElement.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(behind?.hasAttribute('inert')).toBe(false);
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('closes with Escape and returns focus to the control', async () => {
    renderView();
    await openViewer();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(viewLink());
  });

  it('closes with the named close button and returns focus', async () => {
    renderView();
    await openViewer();
    fireEvent.click(screen.getByRole('button', { name: 'Close the catalog' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(viewLink());
  });

  it('keeps Tab inside the dialog', async () => {
    renderView();
    await openViewer();
    const close = screen.getByRole('button', { name: 'Close the catalog' });
    const next = screen.getByRole('button', { name: 'Next page' });
    next.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    close.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(next);
  });

  it('shows the first page number and announces it through a polite status', async () => {
    renderView();
    await openViewer();
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('Page 1 / 8');
    expect(screen.getByRole('group', { name: 'Pages of Catalog 2026' })).toBeTruthy();
  });

  it('turns with the next and previous buttons', async () => {
    renderView();
    await openViewer();
    lib.flipNext.mockImplementation(() => lib.book.props?.onFlip({ data: 1 }));
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(lib.flipNext).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status').textContent).toBe('Page 2 / 8');
    lib.flipPrev.mockImplementation(() => lib.book.props?.onFlip({ data: 0 }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(lib.flipPrev).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status').textContent).toBe('Page 1 / 8');
  });

  it('turns with the arrow keys and ignores them with a modifier', async () => {
    renderView();
    await openViewer();
    flipTo(3);
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(lib.flipNext).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(lib.flipPrev).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'ArrowRight', altKey: true });
    expect(lib.flipNext).toHaveBeenCalledTimes(1);
  });

  it('does not turn past the first or the last page', async () => {
    renderView();
    await openViewer();
    const previous = screen.getByRole('button', { name: 'Previous page' });
    const next = screen.getByRole('button', { name: 'Next page' });
    expect(previous.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(previous);
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(lib.flipPrev).not.toHaveBeenCalled();
    flipTo(7);
    expect(screen.getByRole('status').textContent).toBe('Page 8 / 8');
    expect(next.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(next);
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(lib.flipNext).not.toHaveBeenCalled();
  });

  it('names the buttons and gives them a touch-sized target', async () => {
    renderView();
    await openViewer();
    for (const name of ['Previous page', 'Next page', 'Close the catalog']) {
      const button = screen.getByRole('button', { name });
      expect(button.className).toMatch(/min-h-touch|size-touch/);
    }
  });

  it('shows one page on a narrow stage, with the cover alone on a wide one', async () => {
    renderView();
    await openViewer();
    expect(lib.book.props?.usePortrait).toBe(true);
    cleanup();

    stage.width = 1200;
    stage.height = 800;
    renderView();
    await openViewer();
    expect(lib.book.props?.usePortrait).toBe(false);
    expect(screen.getByRole('status').textContent).toBe('Page 1 / 8');
    flipTo(1);
    expect(screen.getByRole('status').textContent).toBe('Pages 2–3 / 8');
    flipTo(7);
    expect(screen.getByRole('status').textContent).toBe('Page 8 / 8');
  });

  it('sizes the book to the stage', async () => {
    renderView();
    await openViewer();
    // 400 wide minus 2 x 16 padding.
    expect(lib.book.props?.width).toBe(368);
    expect(lib.book.props?.height).toBe(Math.floor(368 / (210 / 297)));
  });

  it('draws the pages near the open one at display size times the pixel ratio, at most 2', async () => {
    vi.stubGlobal('devicePixelRatio', 3);
    renderView();
    await openViewer();
    await waitFor(() => expect(lib.render).toHaveBeenCalledTimes(4));
    // Page 1 is also read once to learn the sheet proportions.
    expect(lib.getPage.mock.calls.map(([number]) => number)).toEqual([1, 1, 2, 3, 4]);
    const [{ viewport, canvas }] = lib.render.mock.calls[0] as [
      { viewport: { width: number }; canvas: HTMLCanvasElement },
    ];
    expect(viewport.width).toBeCloseTo(736);
    expect(canvas.width).toBe(736);
  });

  it('draws pages as they come near and gives back the ones left behind', async () => {
    renderView();
    await openViewer();
    await waitFor(() => expect(lib.render).toHaveBeenCalledTimes(4));
    const canvases = () => [...document.querySelectorAll('canvas')];
    expect(canvases()[0]?.width).toBeGreaterThan(0);
    flipTo(7);
    await waitFor(() => expect(lib.render).toHaveBeenCalledTimes(8));
    await waitFor(() => expect(canvases()[0]?.width).toBe(0));
    expect(canvases()[7]?.width).toBeGreaterThan(0);
  });

  it('turns without the flip animation when reduced motion is asked for', async () => {
    mockReducedMotion(true);
    renderView();
    await openViewer();
    expect(lib.book.props?.flippingTime).toBe(1);
    expect(lib.book.props?.showPageCorners).toBe(false);
    cleanup();

    mockReducedMotion(false);
    renderView();
    await openViewer();
    expect(lib.book.props?.flippingTime).toBeGreaterThan(100);
  });

  it('shows a clear error with the download link when the PDF fails', async () => {
    lib.getDocument.mockImplementation(() => ({
      promise: Promise.reject(new Error('broken')),
      destroy: lib.destroyDocument,
    }));
    renderView();
    fireEvent.click(viewLink());
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('This catalog cannot be shown here.');
    const download = screen.getByRole('link', { name: 'Download the PDF' });
    expect(download.getAttribute('href')).toBe('/demo/catalog-2026.pdf');
    expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull();
  });

  it('shows the same error when a page cannot be drawn', async () => {
    lib.render.mockImplementation(() => ({ promise: Promise.reject(new Error('bad page')), cancel: lib.cancel }));
    renderView();
    fireEvent.click(viewLink());
    expect((await screen.findByRole('alert')).textContent).toBe('This catalog cannot be shown here.');
  });

  it('never draws two passes onto one canvas, as happens when effects run twice in development', async () => {
    const busy = new Set<HTMLCanvasElement>();
    lib.render.mockImplementation(({ canvas }: { canvas: HTMLCanvasElement }) => {
      if (busy.has(canvas)) throw new Error('Cannot use the same canvas during multiple render() operations.');
      busy.add(canvas);
      const promise = new Promise<void>((resolve) =>
        setTimeout(() => {
          busy.delete(canvas);
          resolve();
        }, 0),
      );
      return { promise, cancel: lib.cancel };
    });
    renderView(StrictMode);
    fireEvent.click(viewLink());
    await screen.findByText('Page 1 / 8');
    await waitFor(() => expect(lib.render).toHaveBeenCalled());
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('destroys the document and the worker when the dialog closes', async () => {
    renderView();
    await openViewer();
    fireEvent.click(screen.getByRole('button', { name: 'Close the catalog' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(lib.destroyDocument).toHaveBeenCalledTimes(1);
    expect(lib.destroyWorker).toHaveBeenCalledTimes(1);
    expect(lib.terminate).toHaveBeenCalledTimes(1);
  });

  it('has no axe violations while open', async () => {
    // jsdom has no canvas; axe probes it.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const { container } = renderView();
    await openViewer();
    expect(await axeViolations(container.ownerDocument.body)).toEqual([]);
  });
});
