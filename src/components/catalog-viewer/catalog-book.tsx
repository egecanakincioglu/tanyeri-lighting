'use client';

import { PDFWorker, getDocument, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist';
import HTMLFlipBook from 'react-pageflip';
import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { BookError } from './book-error.tsx';
import { fitBook, type BookFit } from './fit-book.ts';
import type { ViewerLabels } from './viewer-labels.ts';

type Props = { url: string; name: string; labels: ViewerLabels };

type Loaded = { pdf: PDFDocumentProxy; total: number; ratio: number };
type Stage = { width: number; height: number };

/** The slice of the page-flip API that this viewer calls. */
type PageFlipApi = { flipNext: () => void; flipPrev: () => void };
type BookHandle = { pageFlip: () => PageFlipApi };

const STAGE_PADDING = 16;
// Landscape phones are short: the book gets every pixel the bars can spare.
const SHORT_STAGE_PADDING = 6;
const SHORT_HEIGHT = 500;
const RESIZE_SETTLE_MS = 150;
// Pages this far from the open one are drawn; farther ones give their pixels back.
const KEEP_RADIUS = 3;
const MAX_PIXEL_RATIO = 2;

// The library types every setting as required.
const BOOK_SETTINGS = {
  size: 'fixed',
  minWidth: 0,
  maxWidth: 0,
  minHeight: 0,
  maxHeight: 0,
  startZIndex: 0,
  autoSize: false,
  maxShadowOpacity: 0.5,
  showCover: true,
  mobileScrollSupport: false,
  clickEventForward: false,
  useMouseEvents: true,
  swipeDistance: 30,
  disableFlipByClick: false,
} as const;

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

type PageProps = {
  pdf: PDFDocumentProxy;
  number: number;
  width: number;
  height: number;
  near: boolean;
  onFailure: () => void;
};

// The flip library moves these elements around, so each page keeps its canvas in a plain root element.
const PdfPage = forwardRef<HTMLDivElement, PageProps>(function PdfPage(
  { pdf, number, width, height, near, onFailure },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!near || drawn || !canvas) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    (async () => {
      const page = await pdf.getPage(number);
      // A cleanup that ran during the wait must stop this pass, or two renders would share the canvas.
      if (cancelled) return;
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: (width * ratio) / base.width });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      task = page.render({ canvas, viewport });
      await task.promise;
      if (!cancelled) setDrawn(true);
    })().catch(() => {
      if (!cancelled) onFailure();
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [near, drawn, pdf, number, width, onFailure]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (near || !drawn || !canvas) return;
    canvas.width = 0;
    canvas.height = 0;
    setDrawn(false);
  }, [near, drawn]);

  return (
    <div ref={ref} className="relative overflow-hidden bg-white" style={{ width, height }}>
      <canvas ref={canvasRef} aria-hidden="true" className="block size-full" />
      {!drawn && (
        <div aria-hidden="true" className="absolute inset-0 animate-pulse bg-page motion-reduce:animate-none" />
      )}
    </div>
  );
});

function Arrow({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5.5">
      <path
        d={direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const stepClass =
  'inline-flex min-h-touch min-w-touch items-center justify-center rounded-md border border-hairline bg-surface text-ink transition-colors duration-200 hover:border-accent hover:text-accent-text aria-disabled:cursor-not-allowed aria-disabled:border-hairline aria-disabled:text-muted aria-disabled:opacity-50 motion-reduce:transition-none';

export function CatalogBook({ url, name, labels }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const [current, setCurrent] = useState(0);
  const [reducedMotion] = useState(prefersReducedMotion);
  const stageRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<BookHandle | null>(null);
  const failure = useCallback(() => setFailed(true), []);

  useEffect(() => {
    let cancelled = false;
    const worker = new Worker(new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url), { type: 'module' });
    const pdfWorker = PDFWorker.create({ port: worker });
    const task = getDocument({ url, worker: pdfWorker });
    (async () => {
      const pdf = await task.promise;
      const first = await pdf.getPage(1);
      const { width, height } = first.getViewport({ scale: 1 });
      if (!cancelled) setLoaded({ pdf, total: pdf.numPages, ratio: width / height });
    })().catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
      void task.destroy();
      pdfWorker.destroy();
      worker.terminate();
    };
  }, [url]);

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let initial = true;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const pad = window.innerHeight <= SHORT_HEIGHT ? SHORT_STAGE_PADDING : STAGE_PADDING;
      const next = { width: Math.max(0, width - pad * 2), height: Math.max(0, height - pad * 2) };
      clearTimeout(timer);
      if (initial) {
        initial = false;
        setStage(next);
      } else {
        timer = setTimeout(() => setStage(next), RESIZE_SETTLE_MS);
      }
    });
    observer.observe(element);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  const fit: BookFit | null = loaded && stage ? fitBook(stage.width, stage.height, loaded.ratio) : null;
  const total = loaded?.total ?? 0;

  // The library reports the left page of the open spread; a lone page in a spread is the cover or the back.
  const first = current;
  const last = !fit || fit.single || current === 0 ? current : Math.min(current + 1, total - 1);
  const atStart = current <= 0;
  const atEnd = last >= total - 1;

  function turn(direction: 'next' | 'prev') {
    const book = bookRef.current?.pageFlip();
    if (!book) return;
    if (direction === 'next') {
      if (!atEnd) book.flipNext();
    } else if (!atStart) {
      book.flipPrev();
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'ArrowRight') turn('next');
      else if (event.key === 'ArrowLeft') turn('prev');
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });

  if (failed) return <BookError url={url} labels={labels} />;

  const status =
    first === last
      ? fill(labels.page, { page: first + 1, total })
      : fill(labels.pages, { from: first + 1, to: last + 1, total });

  return (
    <>
      <div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute inset-0 grid place-items-center">
          {fit && loaded ? (
            <div
              role="group"
              aria-label={fill(labels.book, { name })}
              style={{ width: fit.width * (fit.single ? 1 : 2), height: fit.height }}
            >
              <HTMLFlipBook
                key={`${fit.single}-${fit.width}-${fit.height}`}
                ref={bookRef}
                className=""
                style={{}}
                {...BOOK_SETTINGS}
                width={fit.width}
                height={fit.height}
                startPage={current}
                usePortrait={fit.single}
                flippingTime={reducedMotion ? 1 : 600}
                drawShadow={!reducedMotion}
                showPageCorners={!reducedMotion}
                onFlip={(event: { data: number }) => setCurrent(event.data)}
              >
                {Array.from({ length: loaded.total }, (_, index) => (
                  <PdfPage
                    key={index}
                    pdf={loaded.pdf}
                    number={index + 1}
                    width={fit.width}
                    height={fit.height}
                    near={Math.abs(index - current) <= KEEP_RADIUS}
                    onFailure={failure}
                  />
                ))}
              </HTMLFlipBook>
            </div>
          ) : (
            <p className="text-base text-muted">{labels.loading}</p>
          )}
        </div>
      </div>
      <div className="flex flex-none items-center justify-center gap-3 border-t border-hairline bg-surface px-4 py-2 [@media(max-height:500px)]:py-0.5">
        <button
          type="button"
          aria-label={labels.previous}
          aria-disabled={atStart}
          onClick={() => turn('prev')}
          className={stepClass}
        >
          <Arrow direction="left" />
        </button>
        <p role="status" className="min-w-28 text-center text-[0.9375rem] font-medium text-ink tabular-nums">
          {loaded ? status : ''}
        </p>
        <button
          type="button"
          aria-label={labels.next}
          aria-disabled={atEnd}
          onClick={() => turn('next')}
          className={stepClass}
        >
          <Arrow direction="right" />
        </button>
      </div>
    </>
  );
}
