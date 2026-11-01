// Pure decision functions of the audit; the browser code in run.ts only collects the facts.
export function hasHorizontalOverflow(scrollWidth: number, innerWidth: number): boolean {
  return scrollWidth > innerWidth;
}

export interface AxeViolation {
  id: string;
  nodes: { target: unknown[] }[];
}

export function summarizeAxe(violations: readonly AxeViolation[]): string[] {
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

export interface ConsoleEntry {
  type: string;
  text: string;
}

/** Console errors and uncaught page errors fail the audit; warnings and logs do not. */
export function consoleProblems(entries: readonly ConsoleEntry[]): string[] {
  return entries.filter((e) => e.type === 'error' || e.type === 'pageerror').map((e) => `${e.type}: ${e.text}`);
}

const FULL_BLEED_MAX_SOURCE = 1920;

export interface ImageFacts {
  src: string;
  /** Pixel width of the file the browser selected (decoded separately; img.naturalWidth is density-corrected). */
  naturalWidth: number;
  /** Rendered width in CSS px. */
  displayWidth: number;
  /** Viewport width in CSS px, without the scrollbar. */
  viewportWidth: number;
  dpr: number;
  hasSrcset: boolean;
  hasSizes: boolean;
}

/**
 * ADR 0009 rule 5: the selected source is at least display width x min(DPR, 2) and at most twice that;
 * every srcset image has sizes. A full-bleed image (displayed at least as wide as the viewport) cannot have a source
 * for every wide screen, so its lower bound is capped at 1920 px; its upper bound stays twice the uncapped width.
 * Hidden images and images without a natural width (not decoded) skip the size check.
 */
export function imageProblem(img: ImageFacts): string | null {
  if (img.hasSrcset && !img.hasSizes) return `${img.src}: srcset without sizes`;
  if (img.displayWidth <= 0 || img.naturalWidth <= 0) return null;
  const needed = img.displayWidth * Math.min(img.dpr, 2);
  const fullBleed = img.displayWidth >= img.viewportWidth;
  const minimum = fullBleed ? Math.min(needed, FULL_BLEED_MAX_SOURCE) : needed;
  if (img.naturalWidth < minimum) {
    return `${img.src}: ${img.naturalWidth}px source is below the ${Math.ceil(minimum)}px needed`;
  }
  if (img.naturalWidth > needed * 2) {
    return `${img.src}: ${img.naturalWidth}px source is more than twice the ${Math.ceil(needed)}px needed`;
  }
  return null;
}

export interface Redirect {
  status: number;
  /** Pathname of the Location header, or null when absent. */
  location: string | null;
}

/** The root redirect is a temporary one (307 or 308) to the expected locale. */
export function redirectProblem(label: string, got: Redirect, expectedPath: string): string | null {
  if (got.status !== 307 && got.status !== 308) return `${label}: status ${got.status}, expected 307 or 308`;
  if (got.location !== expectedPath) return `${label}: redirects to ${got.location}, expected ${expectedPath}`;
  return null;
}
