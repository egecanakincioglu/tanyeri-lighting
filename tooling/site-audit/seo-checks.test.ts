import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pageSeoProblems, readPageSeo, reciprocalProblems, robotsProblems, sitemapUrls } from './checks.ts';

const own = 'http://localhost:3000/en/about';

function html(overrides: { canonical?: string; ld?: string[]; title?: string; description?: string } = {}): string {
  const ld = (overrides.ld ?? [`{"@type":"BreadcrumbList","itemListElement":[{"item":"${own}"}]}`])
    .map((block) => `<script type="application/ld+json">${block}</script>`)
    .join('');
  return `<html><head><title>${overrides.title ?? 'About us'}</title>
<meta name="description" content="${overrides.description ?? 'Who we are'}"/>
<link rel="canonical" href="${overrides.canonical ?? own}"/>
<link rel="alternate" hreflang="tr" href="http://localhost:3000/tr/hakkimizda"/>
<link rel="alternate" hreflang="en" href="${own}"/>
<link rel="alternate" hreflang="x-default" href="http://localhost:3000/tr/hakkimizda"/>
</head><body>${ld}</body></html>`;
}

test('sitemapUrls reads every loc in order', () => {
  const xml =
    '<urlset><url><loc>http://a/tr</loc></url><url><loc> http://a/en </loc><lastmod>x</lastmod></url></urlset>';
  assert.deepEqual(sitemapUrls(xml), ['http://a/tr', 'http://a/en']);
  assert.deepEqual(sitemapUrls('<urlset></urlset>'), []);
});

test('robotsProblems accepts one catch-all group that names the sitemap and closes the API', () => {
  const text = 'User-Agent: *\nAllow: /\nDisallow: /api/\nDisallow: /tr/yonetim\n\nSitemap: http://a/sitemap.xml\n';
  assert.deepEqual(robotsProblems(text, 'http://a/sitemap.xml'), []);
});

test('robotsProblems rejects named bots, a missing sitemap, an open API and content signals', () => {
  const text = 'User-Agent: *\nDisallow: /\n\nUser-Agent: SomeBot\nDisallow: /\nContent-Signal: ai-train=no\n';
  const problems = robotsProblems(text, 'http://a/sitemap.xml');
  assert.equal(problems.length, 4);
  assert.match(problems.join('\n'), /one "User-agent: \*" group/);
  assert.match(problems.join('\n'), /no "Sitemap: http:\/\/a\/sitemap.xml" line/);
  assert.match(problems.join('\n'), /\/api\/ is not disallowed/);
  assert.match(problems.join('\n'), /content signal/);
});

test('readPageSeo reads the canonical, language links, texts and JSON-LD', () => {
  const seo = readPageSeo(html());
  assert.equal(seo.canonical, own);
  assert.deepEqual(seo.alternates, {
    tr: 'http://localhost:3000/tr/hakkimizda',
    en: own,
    'x-default': 'http://localhost:3000/tr/hakkimizda',
  });
  assert.equal(seo.title, 'About us');
  assert.equal(seo.description, 'Who we are');
  assert.equal(seo.jsonLd.length, 1);
  assert.equal(seo.invalidJsonLd, 0);
});

test('readPageSeo counts a JSON-LD block that does not parse', () => {
  const seo = readPageSeo(html({ ld: ['{"@type":', '{"@type":"WebSite"}'] }));
  assert.equal(seo.invalidJsonLd, 1);
  assert.equal(seo.jsonLd.length, 1);
});

test('pageSeoProblems passes a complete page', () => {
  assert.deepEqual(pageSeoProblems('/en/about', readPageSeo(html()), own), []);
});

test('pageSeoProblems reports a wrong canonical, empty texts and broken JSON-LD', () => {
  const seo = readPageSeo(html({ canonical: 'http://localhost:3000/tr', title: '', description: '', ld: ['{'] }));
  const problems = pageSeoProblems('/en/about', seo, own).join('\n');
  assert.match(problems, /canonical http:\/\/localhost:3000\/tr, expected/);
  assert.match(problems, /empty title/);
  assert.match(problems, /empty description/);
  assert.match(problems, /1 JSON-LD block\(s\) do not parse/);
  assert.match(problems, /no JSON-LD/);
});

test('pageSeoProblems reports missing or relative language links', () => {
  const seo = readPageSeo(
    '<head><link rel="canonical" href="' + own + '"/><link rel="alternate" hreflang="en" href="/en/about"/></head>',
  );
  const problems = pageSeoProblems('/en/about', seo, own).join('\n');
  assert.match(problems, /no hreflang tr/);
  assert.match(problems, /no hreflang x-default/);
  assert.match(problems, /not absolute/);
  assert.match(problems, /its own address is in no hreflang link/);
});

test('pageSeoProblems checks the breadcrumb and contact page against the canonical', () => {
  const wrong = readPageSeo(
    html({
      ld: [
        '{"@type":"BreadcrumbList","itemListElement":[{"item":"http://localhost:3000/en"}]}',
        '{"@type":"ContactPage","url":"http://localhost:3000/en/contact"}',
      ],
    }),
  );
  const problems = pageSeoProblems('/en/about', wrong, own).join('\n');
  assert.match(problems, /last breadcrumb is http:\/\/localhost:3000\/en, expected/);
  assert.match(problems, /ContactPage url is/);
});

test('reciprocalProblems accepts pages that name the same set and rejects the rest', () => {
  const set = { tr: 'http://a/tr', en: 'http://a/en', 'x-default': 'http://a/' };
  const ok = new Map([
    ['http://a/tr', set],
    ['http://a/en', { 'x-default': 'http://a/', en: 'http://a/en', tr: 'http://a/tr' }],
  ]);
  assert.deepEqual(reciprocalProblems(ok), []);

  const differing = new Map([
    ['http://a/tr', set],
    ['http://a/en', { ...set, 'x-default': 'http://a/en' }],
  ]);
  assert.match(reciprocalProblems(differing).join('\n'), /set differs/);

  const missing = new Map([['http://a/tr', set]]);
  assert.match(reciprocalProblems(missing).join('\n'), /http:\/\/a\/en is not a listed page/);
});
