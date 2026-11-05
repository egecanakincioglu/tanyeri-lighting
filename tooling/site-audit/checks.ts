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

export function consoleProblems(entries: readonly ConsoleEntry[]): string[] {
  return entries.filter((e) => e.type === 'error' || e.type === 'pageerror').map((e) => `${e.type}: ${e.text}`);
}

const FULL_BLEED_MAX_SOURCE = 1920;

export interface ImageFacts {
  src: string;
  /** Decoded width of the selected file; img.naturalWidth is density-corrected. */
  naturalWidth: number;
  displayWidth: number;
  viewportWidth: number;
  dpr: number;
  hasSrcset: boolean;
  hasSizes: boolean;
}

function isVector(src: string): boolean {
  return /^data:image\/svg\+xml/i.test(src) || /\.svg([?#]|$)/i.test(src);
}

/**
 * The selected source is at least display width x min(DPR, 2) and at most twice that, and every srcset image has sizes.
 * Full-bleed images cap the lower bound at 1920 px.
 * SVG skips the upper bound; hidden or undecoded images skip the check.
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
  // A vector scales without extra bytes.
  if (img.naturalWidth > needed * 2 && !isVector(img.src)) {
    return `${img.src}: ${img.naturalWidth}px source is more than twice the ${Math.ceil(needed)}px needed`;
  }
  return null;
}

export interface Redirect {
  status: number;
  location: string | null;
}

export function redirectProblem(label: string, got: Redirect, expectedPath: string): string | null {
  if (got.status !== 307 && got.status !== 308) return `${label}: status ${got.status}, expected 307 or 308`;
  if (got.location !== expectedPath) return `${label}: redirects to ${got.location}, expected ${expectedPath}`;
  return null;
}

export function sitemapUrls(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1]!.trim());
}

export function robotsProblems(text: string, sitemapUrl: string): string[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const problems: string[] = [];
  const groups = lines.filter((line) => /^user-agent:/i.test(line)).map((line) => line.replace(/^user-agent:\s*/i, ''));
  if (groups.length !== 1 || groups[0] !== '*')
    problems.push(`robots.txt: expected one "User-agent: *" group, got [${groups}]`);
  if (!lines.some((line) => /^sitemap:/i.test(line) && line.replace(/^sitemap:\s*/i, '') === sitemapUrl)) {
    problems.push(`robots.txt: no "Sitemap: ${sitemapUrl}" line`);
  }
  if (!lines.includes('Disallow: /api/')) problems.push('robots.txt: /api/ is not disallowed');
  if (/^(content-signal|content-usage):/im.test(text)) problems.push('robots.txt: has a content signal line');
  return problems;
}

function attributes(tag: string): Record<string, string> {
  return Object.fromEntries(
    [...tag.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)].map((match) => [match[1]!.toLowerCase(), match[2]!]),
  );
}

export interface PageSeo {
  canonical: string | null;
  alternates: Record<string, string>;
  title: string;
  description: string;
  jsonLd: { '@type'?: string; [key: string]: unknown }[];
  invalidJsonLd: number;
}

export function readPageSeo(html: string): PageSeo {
  const links = [...html.matchAll(/<link\b[^>]*>/g)].map((match) => attributes(match[0]));
  const alternates: Record<string, string> = {};
  for (const link of links) {
    if (link.rel === 'alternate' && link.hreflang && link.href) alternates[link.hreflang] = link.href;
  }
  const metas = [...html.matchAll(/<meta\b[^>]*>/g)].map((match) => attributes(match[0]));
  const jsonLd: PageSeo['jsonLd'] = [];
  let invalidJsonLd = 0;
  for (const block of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      jsonLd.push(JSON.parse(block[1]!));
    } catch {
      invalidJsonLd += 1;
    }
  }
  return {
    canonical: links.find((link) => link.rel === 'canonical')?.href ?? null,
    alternates,
    title: /<title>([^<]*)<\/title>/.exec(html)?.[1]?.trim() ?? '',
    description: metas.find((meta) => meta.name === 'description')?.content?.trim() ?? '',
    jsonLd,
    invalidJsonLd,
  };
}

export function pageSeoProblems(label: string, seo: PageSeo, ownUrl: string): string[] {
  const problems: string[] = [];
  if (seo.canonical !== ownUrl) problems.push(`${label}: canonical ${seo.canonical}, expected ${ownUrl}`);
  for (const language of ['tr', 'en', 'x-default']) {
    if (!seo.alternates[language]) problems.push(`${label}: no hreflang ${language}`);
  }
  if (!Object.values(seo.alternates).every((href) => /^https?:\/\//.test(href))) {
    problems.push(`${label}: hreflang addresses are not absolute`);
  }
  if (seo.alternates.tr !== ownUrl && seo.alternates.en !== ownUrl) {
    problems.push(`${label}: its own address is in no hreflang link`);
  }
  if (seo.title === '') problems.push(`${label}: empty title`);
  if (seo.description === '') problems.push(`${label}: empty description`);
  if (seo.invalidJsonLd > 0) problems.push(`${label}: ${seo.invalidJsonLd} JSON-LD block(s) do not parse`);
  if (seo.jsonLd.length === 0) problems.push(`${label}: no JSON-LD`);
  for (const block of seo.jsonLd) {
    const items = block['@type'] === 'BreadcrumbList' ? (block.itemListElement as { item?: string }[]) : [];
    if (items.length > 0 && items.at(-1)?.item !== ownUrl) {
      problems.push(`${label}: the last breadcrumb is ${items.at(-1)?.item}, expected ${ownUrl}`);
    }
    if (block['@type'] === 'ContactPage' && block.url !== ownUrl) {
      problems.push(`${label}: ContactPage url is ${block.url}, expected ${ownUrl}`);
    }
  }
  return problems;
}

export function reciprocalProblems(pages: ReadonlyMap<string, PageSeo['alternates']>): string[] {
  const problems: string[] = [];
  for (const [url, alternates] of pages) {
    for (const language of ['tr', 'en']) {
      const target = alternates[language];
      if (!target || target === url) continue;
      const back = pages.get(target);
      if (!back) problems.push(`${url}: hreflang ${language} ${target} is not a listed page`);
      else if (JSON.stringify(Object.entries(back).sort()) !== JSON.stringify(Object.entries(alternates).sort())) {
        problems.push(`${url}: hreflang set differs from the one at ${target}`);
      }
    }
  }
  return problems;
}
