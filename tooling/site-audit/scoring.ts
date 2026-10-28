// Pure decisions of the Lighthouse legs (ADR 0010): medians, transfer budgets, red or warning. Lighthouse itself
// only runs in run.ts.
const CATEGORY_IDS = ['performance', 'accessibility', 'best-practices', 'seo'] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export interface Thresholds {
  categories: Record<CategoryId, number>;
  expected: number;
  budgets: { scriptKB: number; stylesheetKB: number; fontFiles: number; fontKB: number; totalKB: number };
}

/** The part of a Lighthouse result this tooling reads. */
export interface LhrLike {
  categories: Record<string, { score: number | null; auditRefs?: { id: string }[] }>;
  audits: Record<
    string,
    {
      title?: string;
      score: number | null;
      scoreDisplayMode?: string;
      details?: { items?: { resourceType?: string; transferSize?: number }[] };
    }
  >;
}

export interface Transfer {
  scriptKB: number;
  stylesheetKB: number;
  fontFiles: number;
  fontKB: number;
  totalKB: number;
}

export function median(values: number[]): number {
  if (values.length === 0) throw new Error('median of nothing');
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Category score on the 0-100 scale; a category Lighthouse did not score counts as 0. */
function categoryScore(lhr: LhrLike, id: CategoryId): number {
  return Math.round((lhr.categories[id]?.score ?? 0) * 100);
}

export function medianScores(runs: LhrLike[]): Record<CategoryId, number> {
  return Object.fromEntries(CATEGORY_IDS.map((id) => [id, median(runs.map((r) => categoryScore(r, id)))])) as Record<
    CategoryId,
    number
  >;
}

/** The run whose performance score is the median; budgets and agentic audits are read from it. */
export function medianRun(runs: LhrLike[]): LhrLike {
  const sorted = [...runs].sort((a, b) => categoryScore(a, 'performance') - categoryScore(b, 'performance'));
  return sorted[Math.floor((sorted.length - 1) / 2)]!;
}

const kb = (bytes: number) => Math.round((bytes / 1024) * 10) / 10;

export function transferOf(lhr: LhrLike): Transfer {
  const items = lhr.audits['network-requests']?.details?.items ?? [];
  let script = 0;
  let stylesheet = 0;
  let font = 0;
  let fontFiles = 0;
  let total = 0;
  for (const item of items) {
    const size = item.transferSize ?? 0;
    total += size;
    if (item.resourceType === 'Script') script += size;
    else if (item.resourceType === 'Stylesheet') stylesheet += size;
    else if (item.resourceType === 'Font') {
      font += size;
      fontFiles += 1;
    }
  }
  return { scriptKB: kb(script), stylesheetKB: kb(stylesheet), fontFiles, fontKB: kb(font), totalKB: kb(total) };
}

/** Titles of applicable audits of the Agentic Browsing category that did not pass. */
export function agenticFailures(lhr: LhrLike): string[] {
  const refs = lhr.categories['agentic-browsing']?.auditRefs ?? [];
  const failed: string[] = [];
  for (const { id } of refs) {
    const audit = lhr.audits[id];
    if (!audit || audit.score === null || audit.score >= 1) continue;
    if (['notApplicable', 'manual', 'informative'].includes(audit.scoreDisplayMode ?? '')) continue;
    failed.push(audit.title ?? id);
  }
  return failed;
}

export interface Verdict {
  failures: string[];
  warnings: string[];
}

export function judge(
  where: string,
  scores: Record<CategoryId, number>,
  transfer: Transfer,
  agentic: string[],
  t: Thresholds,
): Verdict {
  const failures: string[] = [];
  const warnings: string[] = [];
  for (const id of CATEGORY_IDS) {
    if (scores[id] < t.categories[id]) failures.push(`${where}: ${id} ${scores[id]} is below ${t.categories[id]}`);
    else if (scores[id] < t.expected)
      warnings.push(`${where}: ${id} ${scores[id]} is below the expected ${t.expected}`);
  }
  const limits: [keyof Transfer, number][] = [
    ['scriptKB', t.budgets.scriptKB],
    ['stylesheetKB', t.budgets.stylesheetKB],
    ['fontFiles', t.budgets.fontFiles],
    ['fontKB', t.budgets.fontKB],
    ['totalKB', t.budgets.totalKB],
  ];
  for (const [key, max] of limits) {
    if (transfer[key] > max) failures.push(`${where}: ${key} ${transfer[key]} exceeds ${max}`);
  }
  for (const title of agentic) failures.push(`${where}: agentic browsing audit failed: ${title}`);
  return { failures, warnings };
}
