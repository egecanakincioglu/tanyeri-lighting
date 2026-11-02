import { describe, expect, it } from 'vitest';
import { fitBook, SPREAD_MIN_WIDTH } from './fit-book.ts';

const A4 = 210 / 297;

describe('fitBook', () => {
  it('shows one page on a narrow stage and fills the width', () => {
    expect(fitBook(358, 900, A4)).toEqual({ single: true, width: 358, height: 506 });
  });

  it('limits the page by the height when the stage is short', () => {
    const fit = fitBook(320, 300, A4);
    expect(fit.height).toBeLessThanOrEqual(300);
    expect(fit.width).toBe(Math.floor(300 * A4));
  });

  it('switches to a spread at the breakpoint and halves the width per page', () => {
    expect(fitBook(SPREAD_MIN_WIDTH - 1, 2000, A4).single).toBe(true);
    const fit = fitBook(SPREAD_MIN_WIDTH, 2000, A4);
    expect(fit.single).toBe(false);
    expect(fit.width).toBe(SPREAD_MIN_WIDTH / 2);
  });

  it('keeps a spread inside a wide, short stage', () => {
    const fit = fitBook(2560, 600, A4);
    expect(fit.height).toBeLessThanOrEqual(600);
    expect(fit.width * 2).toBeLessThanOrEqual(2560);
  });

  it('never returns an empty page', () => {
    expect(fitBook(0, 0, A4)).toEqual({ single: true, width: 1, height: 1 });
  });
});
