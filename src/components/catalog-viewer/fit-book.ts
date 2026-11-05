export const SPREAD_MIN_WIDTH = 768;

export type BookFit = { single: boolean; width: number; height: number };

/** `width` and `height` are one page; a spread is twice as wide. */
export function fitBook(stageWidth: number, stageHeight: number, ratio: number): BookFit {
  const single = stageWidth < SPREAD_MIN_WIDTH;
  const width = Math.max(1, Math.floor(Math.min(stageWidth / (single ? 1 : 2), stageHeight * ratio)));
  return { single, width, height: Math.max(1, Math.floor(width / ratio)) };
}
