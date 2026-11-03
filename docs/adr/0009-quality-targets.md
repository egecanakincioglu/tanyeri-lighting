# ADR 0009: Quality targets — SEO, AI search visibility, accessibility, performance, agent access and responsive design on every device

Status: Accepted; partly changed by [ADR 0010](0010-quality-thresholds.md) and [ADR 0011](0011-versioning-and-releases.md)
Date: 2026-10-28

## Context

An earlier decision said "no Lighthouse gates". On 2026-10-28 the goal changed: the project must show a full score, in a measurable way, in all of these layers:

- SEO.
- GEO: visibility in AI search and answer engines, and correct attribution of sources.
- Accessibility.
- Performance.
- Agent layer: AI agents must be able to read, understand and use the site (navigate, find products, submit the contact form).
- Responsive design: a flawless look on phone, tablet and desktop.

A "full score" is only a claim unless a tool measures it and a failure breaks CI. This ADR defines the criterion, the tool, the place of measurement and the gate for each layer.

Constraints:

- Because of the nonce-based CSP, all pages render dynamically; there is no static generation, ISR or Cache Components ([ADR 0001](0001-architecture-nextjs-16-app-router.md)).
- `/tr` and `/en` always carry a prefix, URLs are in the language of each locale, and the root `/` redirects by `Accept-Language` ([ADR 0006](0006-internationalization-next-intl.md)).
- There is no browser tool in the tests ([ADR 0007](0007-testing-strategy.md)).
- CI runs only on GitHub runners; actions come only from GitHub and verified publishers, pinned by SHA ([ADR 0008](0008-ci-and-protection-layers.md)).
- `dangerouslySetInnerHTML` is forbidden by a Semgrep rule; the way to write JSON-LD was an open question.
- The demo runs on Vercel Hobby; preview deployments are protected and `noindex`.
- The design review found the biggest gap of the old site in the first screen: no text and no action; the fix is an `h1` with a value proposition and two actions in the banner.

Verified facts:

- The latest Lighthouse release is 13.6.0 (2026-10-27). It has five categories: performance, accessibility, best practices, SEO and the experimental "Agentic Browsing". The last one shows the ratio of passed audits, not a 0–100 score. The WebMCP, `llms.txt` and ARD audits count as "not applicable" when the file or API is missing, and they do not lower the ratio; this was checked in the source code.
- The accessibility category of Lighthouse runs axe-core only with the `wcag2a` and `wcag2aa` tags and with some rules turned off; it does not cover all of WCAG 2.1 and 2.2 AA. According to a Deque report, automated testing finds about 57% of issues.
- The latest Lighthouse CI release is 0.15.1 (2025-06) and it is pinned to Lighthouse 12.6.1; it has no agent category.
- According to Google's 2026 guide, there are no extra requirements for AI features; this is still SEO. A page must be indexed to appear. Google Search does not use `llms.txt`. Structured data is not required for AI features; it is recommended for rich results.
- Most major AI crawlers do not run JavaScript (Vercel analysis, 2024-12); the content must be in the HTML that the server sends.
- WebMCP is a proposed standard; in Chrome it is in an origin trial.
- The build output of Next.js 16 does not show bundle sizes; the JavaScript budget has to be measured from the resource summary of Lighthouse.
- Measured on a local machine (Windows, Chrome 156, Next.js 16.4.3, React 19.3.1, next-intl 4.14.9, Lighthouse 13.6.0, nonce-based CSP, local `next start`):
  - A page whose LCP element is text: mobile and desktop performance 100, accessibility 100, SEO 100, full agent category. JavaScript transfer 150 KB (7 requests).
  - The same page with an image as the LCP element (6 KB, `preload` and `fetchPriority="high"`): mobile performance 98–99, LCP 2.04–2.13 s; desktop 100. The difference does not come from the size of the image: the Lighthouse simulation adds the framework's JavaScript to the LCP.
  - With a nonce in `style-src`, the inline `style` attribute of `next/image` was blocked. Best practices fell to 88–92 because of a console error; the image stayed 1600 px wide and there was horizontal overflow at every width below 1616 px. Performance, accessibility and SEO were 100, and axe found nothing. Only the console error check and the overflow check caught the problem.
  - When JSON-LD was written as a text child of a `<script type="application/ld+json">` element, the server render of React 19.3 escaped the sequences `<script` and `</script`. `dangerouslySetInnerHTML` was not needed, there was no CSP error, and best practices and SEO stayed 100. According to the HTML standard, data blocks are not subject to CSP at all.

## Options considered

Where to measure:

| Option | Pros | Cons | Result |
|---|---|---|---|
| A local production build in CI (`next build` + `next start`, Postgres service container, demo seed) | The same commit is measured; independent of Vercel; no preview protection or `noindex`; no network noise; the same command runs locally | Does not measure cold start and regional latency in production | Chosen |
| Vercel preview URL | The real platform | Previews are protected and send `X-Robots-Tag: noindex` (SEO score drops); one must wait for the deployment; deployment on fork PRs needs approval; network and cold-start noise; dependency on Vercel | Rejected |
| PageSpeed Insights API | Google's own measurement | Needs a public URL; noisy; cannot be a required check | Only for production measurement in phase 9 |

With which tool:

| Option | Pros | Cons | Result |
|---|---|---|---|
| Lighthouse 13.6 (Node API or CLI), puppeteer-core and axe-core with a small, tested script | Current Lighthouse and the agent category; puppeteer-core is already a dependency of Lighthouse; all WCAG 2.2 AA tags; overflow, touch target and console in the same browser | The median and threshold logic is written and tested by the project | Chosen |
| Lighthouse CI (`@lhci/cli`) | Ready-made collection and assertion | No release since 2025-06; pinned to Lighthouse 12.6.1; no agent category; axe and overflow checks are still needed separately | Rejected |
| An end-to-end test framework that downloads a browser, and its axe plugin | Full user-flow tests | Large dependency and maintenance; reverses ADR 0007 completely; the need is page audits, not flow tests | Rejected |

Mobile performance gate:

| Option | Pros | Cons | Result |
|---|---|---|---|
| Strict 100; on mobile the first screen opens with text | A full score is proven from the start on every page; same direction as the first-screen fix from the design review | On mobile, an image cannot be the LCP element in any template; narrow margin for run-to-run variation | Chosen (changed by [ADR 0010](0010-quality-thresholds.md)) |
| At least 98, a threshold that only goes up | Free design; resistant to noise | Some pages may show 98–99 on mobile; the full-score claim is postponed | Rejected |

`style-src` in the CSP:

| Option | Pros | Cons | Result |
|---|---|---|---|
| `style-src 'self' 'unsafe-inline'` | `next/image` and React style attributes work; the script rule stays as strict | CSS injection is theoretically open; HTML injection is needed first | Chosen |
| Nonce, `'unsafe-hashes'` and fixed hashes; `style` property forbidden | Stricter | A separate hash for each style string of `next/image`; breaks when the string changes in a Next.js version; small benefit | Rejected |

Indexing and crawlers:

| Option | Pros | Cons | Result |
|---|---|---|---|
| Production is indexed; one rule for all crawlers, no names | The full SEO and GEO score is also shown in production; no maintenance | The fictional brand appears in search results; bots may use up the Hobby quota | Chosen |
| Allow search and user-requested agents, block training crawlers | A usage preference is stated | Crawler names go into robots; compliance is voluntary; the name-free methods (`Content-Signal`, IETF aipref) are drafts | Rejected |
| Production `noindex`, or block all crawlers | No fictional company in search results; low bot load | SEO cannot be 100 in production; GEO cannot be shown | Rejected |

## Decision

**The quality targets are tied to measurable gates.** Measurement runs in CI against a local production build: Lighthouse 13.6, axe-core 4.14 and puppeteer-core 25, in Chrome on GitHub's Ubuntu runner. The new job `site-audit` becomes a required check with three arms. The four Lighthouse categories are 100 on mobile and on desktop; on mobile the first screen opens with text. `style-src 'self' 'unsafe-inline'`. Production is indexed, previews are not; robots gives the same rule to all crawlers. No end-to-end test framework is added; page audits run in a real browser.

Rules:

1. Definition of a full score. The Lighthouse gates are evaluated on two form factors, with the median of three runs per template.

   | Layer | Full score | Tool | Job |
   |---|---|---|---|
   | Performance | Mobile 100, desktop 100. On mobile, the LCP element of every template is text (rule 4). Budgets are in rule 6 | Lighthouse 13.6.0, simulated throttling | `site-audit (mobile)`, `site-audit (desktop)` |
   | Accessibility | Lighthouse 100. axe violations 0 (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice`); at every width of the device set, in both languages. axe violations 0 in component tests (except `color-contrast`: jsdom does not compute colors). Manual WCAG 2.2 AA review in phase 8 | Lighthouse; axe-core 4.14.0; Vitest | `site-audit`, `test` |
   | Best practices | Lighthouse 100. No console error or CSP violation at any width | Lighthouse; puppeteer-core | `site-audit` |
   | SEO | Lighthouse 100. Every public URL returns 200; the canonical is absolute and points to the page itself; the `tr`, `en` and `x-default` hreflang links are reciprocal; title and description are filled in both languages; `robots.txt` and `sitemap.xml` are valid; JSON-LD parses, has the expected type and is at the same address as the canonical | Lighthouse; the project's own HTTP check; `schema-dts` types; unit tests | `site-audit (pages)`, `test` |
   | GEO | All of SEO, and also: main content, navigation and metadata in the raw HTML without JavaScript; no `nosnippet` or `max-snippet`; robots gives the same rule to all crawlers; `lastmod` is the real update time. After launch, the generative AI report in Search Console | HTTP check; tests; Search Console (manual) | `site-audit (pages)`, phase 9 |
   | Agent access | All applicable audits in Lighthouse "Agentic Browsing" pass. axe violations 0. Forms are labeled, have `autocomplete`, correct input types, and error text tied to the field. The contact form can be submitted with JavaScript off. No open modal, cookie wall or CAPTCHA when the page opens | Lighthouse 13.6.0; axe; puppeteer-core | `site-audit` |
   | Responsive design | Horizontal overflow 0 every 16 px in the 320–2560 px range and in the device set. `target-size` violations 0 (WCAG 2.2 AA, 24×24 CSS px). Image size is right at every width (rule 5). No `100vh` and no `h-screen`. No `viewport-fit=cover`. No content or action that can be reached only by hovering. Manual visual check at four widths | puppeteer-core and axe; Semgrep; manual | `site-audit (pages)`, `quality`, PR |

   The thresholds are in `tooling/site-audit/thresholds.json`. The categories are already 100, so they never go below 100; budgets only get smaller. `policy` rejects loosening, as with the coverage threshold; tightening is a separate commit.

2. Measurement environment. Each arm runs `pnpm build` and `pnpm start` on its own runner. Migrations and the demo seed are applied to the Postgres service container from the phase in which they exist. `SITE_URL=http://localhost:3000`, so the canonical, hreflang and sitemap stay consistent within themselves. Chrome is the one installed on the runner; its version is written in the report. The same audit runs locally with the same script.

3. Stability.
   - Lighthouse runs with simulated throttling (the default).
   - Before measuring, every URL is warmed up once (the first build and the cache of the image optimizer).
   - Three runs per form factor for each URL; the gate looks at the median. The Lighthouse documentation finds the median of five runs twice as stable as a single run; if variation shows up in the phase 3 measurement, the run count goes up to five. With instability the threshold does not drop; the page's share (budget) gets smaller.
   - In one arm the Lighthouse runs execute in sequence; the arms run on separate machines.
   - A real threshold violation is not re-run. For an infrastructure failure the existing rule applies: at most one re-run per PR.
   - The reports (Lighthouse JSON and HTML, axe results, screenshots) become artifacts kept for seven days.

4. On mobile the first screen opens with text.
   - On the home page the mobile LCP element is the `h1`: the banner heading, which is the value proposition. The banner image is secondary: it sits under the text and takes less area than the `h1` in the first screen, or starts below the first screen; it is not an LCP candidate on mobile.
   - The same principle applies to all public templates: on mobile the largest element of the first screen is text. On the product page, the product name and summary come first and the product image after; on project and reference pages, the title and description come first.
   - `site-audit (mobile)` also checks on every template that the LCP element of Lighthouse is text, so the reason for a red result is visible before the score drops.
   - On desktop an image LCP is free; in the measurement, the page with an image LCP scored 100 on desktop.
   - This rule also closes the first-screen finding of the design review: the first screen has text and actions.

5. Device set and responsive design criteria. The widths were chosen from StatCounter's 2026-09 data and WCAG 2.2:

   | Class | CSS px | Touch, DPR | Why |
   |---|---|---|---|
   | Small phone | 320×568 | yes, 2 | WCAG 1.4.10 reflow: 400% zoom of 1280 px |
   | Android phone | 360×800 | yes, 3 | Second most common in the world |
   | iPhone | 390×844 | yes, 3 | Design base and the phone width in the manual visual check |
   | Large phone | 414×896 | yes, 3 | Most common in the world and in Turkey |
   | Landscape phone | 844×390 | yes, 3 | Orientation (WCAG 1.3.4); behavior of the fixed header and menu on a short screen |
   | Portrait tablet | 768×1024 | yes, 2 | Most common tablet; `md` breakpoint |
   | Landscape tablet, small laptop | 1024×768 | yes, 2 | `lg` breakpoint; the width where the desktop menu starts |
   | Desktop | 1440×900 | no, 1 | `xl` breakpoint; the desktop width in the manual visual check |
   | Wide desktop | 1920×1080 | no, 1 | Most common on desktop (28%) |
   | Extra-wide desktop | 2560×1440 | no, 1 | Check of the content width limit |

   - Overflow: in the device set and in the 320–2560 px sweep, `document.documentElement.scrollWidth` does not exceed the viewport width. 200% zoom equals 640 px and 400% zoom equals 320 px; both are in the sweep. A component that scrolls horizontally (for example the category bar) stays inside its own scroll container; the page does not overflow.
   - Touch target: axe `target-size` (WCAG 2.5.8, 24×24 CSS px) gives no violation at touch widths. Primary controls (buttons, menu and language switcher) are at least 44 px through a design token; this is a design rule, not a gate.
   - Reflow and text: `meta viewport` does not disable zoom (axe `meta-viewport`); text spacing and orientation lock are covered by the axe rules `avoid-inline-spacing` and `css-orientation-lock`.
   - Safe areas: `viewport-fit=cover` is not used, so the browser keeps content inside the notch and corner areas. If it is ever needed, fixed elements use `env(safe-area-inset-*)`.
   - Dynamic viewport units: full height is given with `dvh` or `svh` (`h-dvh`, `min-h-svh`). `100vh`, `h-screen` and `min-h-screen` are forbidden by a Semgrep rule.
   - Hover: in Tailwind 4, `hover:` applies only on devices that support `(hover: hover)`. Information or an action is never opened by hover only; expandable content opens with a button that has `aria-expanded`; tooltips follow WCAG 1.4.13. Component tests are written with click and keyboard.
   - Image size: at every width of the device set, after lazy images have loaded, the pixel width of the file the browser selects for each image (decoded separately, since `naturalWidth` is density-corrected for `srcset`) is not smaller than the displayed width times the DPR (at most 2) and does not exceed twice that. For a full-bleed image (displayed at least as wide as the viewport) the lower bound is capped at 1920 px and the upper bound stays twice the uncapped value. Every image with a `srcset` has a `sizes` attribute. A vector source (SVG) is exempt from the upper bound, because its intrinsic size does not change the bytes the browser downloads; the lower bound and the `sizes` rule still apply.
   - Console: no console error or CSP violation at any width.
   - Manual visual check: at 390, 768, 1024 and 1440 widths; for changes that touch the fixed header, the menu or a dialog, also at 844×390. `site-audit (pages)` uploads screenshots of these five viewports as artifacts. There is no visual diff (pixel comparison) test.

6. Performance budget. The initial values are below; they are measured and fixed on the runner in phase 3, and after that they only get smaller.

   | Metric | Mobile (median) | Desktop (median) |
   |---|---|---|
   | Lighthouse performance | 100 | 100 |
   | LCP element | text | free |
   | CLS | at most 0.02 | at most 0.02 |
   | TBT | at most 90 ms | at most 60 ms |
   | JavaScript transfer | at most 180 KB | same |
   | CSS transfer | at most 30 KB | same |
   | Fonts | at most 2 files, 100 KB | same |
   | Total transfer | at most 500 KB | same |

   The TBT limits come from the upper values that keep the category score at 100 while the other metrics are perfect (see the measurements in the Context).

   Design rules:
   - Components are server components by default; a client component is written only for interaction.
   - Only the needed message namespaces are given to the client provider of next-intl.
   - The image in the first screen is loaded with `next/image` with `loading="eager"`, `fetchPriority="high"` and the correct `sizes`, because `preload` is not for use with `fetchPriority` and did not help; the first item of each list is eager. Images outside the first screen are lazy loaded.
   - Fonts come from `next/font`, at most two files.
   - The catalog viewer is loaded only when the user opens it.
   - No third-party scripts.

   INP is not measured in the lab; in Lighthouse navigation mode its weight is 0 and its proxy is TBT. Demo traffic is not enough to create field data (CrUX); the project adds no real-user measurement.

7. Structured data and JSON-LD.
   - A single component: `src/components/json-ld.tsx`. It writes the data as `<script type="application/ld+json">{serializeJsonLd(data)}</script>`. `serializeJsonLd` turns every `<` character in the `JSON.stringify` output into `<`; this is an extra layer on top of the escaping in React, and it does not rely on it.
   - `dangerouslySetInnerHTML` is not used; the Semgrep rule does not change and there is no exception.
   - New Semgrep rule: a JSX `<script>` element may exist only in this file.
   - The data block gets no nonce; according to the HTML standard it is not subject to CSP.
   - Types come from `schema-dts`, only with `import type`.
   - Types of data:
     - Home page: `WebSite` and `Organization`. `Organization` has a name, address (URL), logo, `sameAs` (the repository) and `contactPoint` (email, phone, `areaServed`, `availableLanguage`). `hoursAvailable` is not sent: the settings hold opening hours only as free text.
     - Contact page: `ContactPage`; it refers to the same `Organization` by `@id`.
     - Inner pages: `BreadcrumbList`.
     - No `LocalBusiness`: the brand is fictional and has no physical location; the fictional postal address does not go into structured data.
     - No `Product` and `Offer`: nothing is for sale. Google's product snippet needs one of `offers`, `review` or `aggregateRating`; if the pricing decision for products changes this, it is reviewed again. Product details stay in semantic HTML (`dl`).
   - Structured data carries only information that is visible on the page.
   - Tests:
     - The component is tested with `renderToString`: only one `</script>` remains; a string that contains `</script><script>` comes back unchanged when parsed.
     - The required fields of every data builder are covered in a unit test.
     - `site-audit (pages)` parses the JSON-LD on every page and checks its type and address.
     - In phase 9, the Rich Results Test and the Schema Markup Validator are run by hand on production.

8. Indexing, canonical, hreflang and sitemap.
   - Production is indexed. Preview deployments keep Vercel's `X-Robots-Tag: noindex` header.
   - The canonical of every page is the absolute address in its own language; URLs are in the language of each locale ([ADR 0006](0006-internationalization-next-intl.md), rule 9). `metadataBase` comes from the validated `SITE_URL`.
   - hreflang is produced by a single helper function and is given only in HTML (`alternates.languages`): `tr`, `en` and `x-default`. The `x-default` of the home page is the root `/`, which redirects by language; the `x-default` of other pages is the Turkish (default language) address. Google defines `x-default` for unmatched languages and for language selector or redirect pages.
   - The `Link` header of next-intl is turned off (`alternateLinks: false`), so there is a single source. Google treats the three methods as equal; using more than one has no benefit for search.
   - The root redirect stays. Prefixed URLs are never redirected; Googlebot does not send `Accept-Language`, so it lands on `/tr`; every page has a link to the other language.
   - Metadata comes from the database in two languages and both are required; the open item in ADR 0006 about missing translations is closed in this direction in phase 4. This way the hreflang pairs are always complete.
   - `sitemap.ts` is dynamic (there is no database at build time). Every URL in every language is listed; `lastModified` is the `updatedAt` of the record.

9. Crawlers and agents.
   - `robots.ts` gives the same rule to all crawlers (`User-agent: *`): public pages are open; `/api/` and admin paths are closed; the sitemap address is written. No crawler is named.
   - `llms.txt`, ARD (`/.well-known/ard.json`) and a `Content-Signal` or `Content-Usage` line are not added. Google Search does not use `llms.txt`; Lighthouse counts its absence as "not applicable"; ARD 0.91 and the IETF aipref work are still drafts. If an AI search engine documents that it reads `llms.txt`, this is reconsidered.
   - Rule 9 is reversed for `llms.txt` only. The site serves `/llms.txt`, a short Markdown map of the main pages in both languages with a note that the brand is a fictional demo. Google Search does not use this file and no measured effect on search or answer engines is known. It exists to answer the Lighthouse `llms-txt` audit and to give plain-text readers a map. ARD stays out.
   - For agent access:
     - Interactive elements are native `button` and `a`.
     - Labels are tied to fields with `for`.
     - No transparent overlay over interactive elements.
     - The layout is stable (CLS budget).
     - The demo banner is part of the page, not a modal.
     - No CAPTCHA; the contact form is protected by rate limiting ([ADR 0004](0004-rate-limiting.md)).
     - No cookie wall: the language cookie of next-intl is a session cookie and is written only when the language changes.
   - The contact form works as a native `form` with a Server Action; it can also be submitted before JavaScript loads. `site-audit (pages)` tests this with a single scenario with JavaScript off. This is the only functional browser scenario in the project.
   - The `Permissions-Policy` header does not turn off the `tools` feature of WebMCP.

10. `style-src` in the CSP. `style-src 'self' 'unsafe-inline'`; the script rule stays as in ADR 0001 (nonce, `'strict-dynamic'`, no `'unsafe-inline'` for scripts). `next/image` and the React `style` property produce an inline `style` attribute, and a nonce cannot be given to an attribute. A `style-src` with a nonce blocks these attributes; in the measurement it broke the layout and lowered the best practices score. The remaining risk is CSS injection, which needs HTML injection first; React escapes text and `dangerouslySetInnerHTML` is forbidden. The `style` property is still not written in code; styling is in Tailwind ([ADR 0005](0005-styling-tailwind-css-4.md)).

11. Production performance. The gate is the lab measurement in CI; the production score is not a gate. In production:
    - The Vercel function region and the Neon region are the same (Frankfurt: `fra1` and `aws-eu-central-1`). The Neon region is chosen when the project is created; this is done in the manual step in phase 3; `regions` in `vercel.json`.
    - The database is reached with the pooled connection address.
    - The visit record is written after the response with `after()`.
    - The beacon component that sends the visit is very small and does not import next-intl, to keep the home page weight low.
    - Public pages do not run session queries.
    - `unstable_cache` is not used: in Next.js 16 `use cache` replaced it, it needs Cache Components, and ADR 0001 keeps those off. The topic is revisited together with ADR 0001 in Next.js 17.
    - In phase 9, production is measured with PageSpeed Insights and the result is recorded.

12. Scope.
    - Every public page template goes through HTTP, axe, overflow and console checks in both languages. The Lighthouse arms measure every template at its Turkish address and the home page in both languages; language-dependent differences (title, description, `lang`, alternative text) are already checked in both languages.
    - The 404 template is exempt from Lighthouse SEO (the expected status is 404) but goes through the axe, overflow and console checks.
    - From phase 7, the admin panel goes through the `site-audit (pages)` checks (axe, overflow, console) with a demo admin session. The panel is `noindex`, so it has no Lighthouse run.
    - Every page template has an address in the audit list. If a `page.tsx` under `src/app/[locale]/(site)` has no address in the list, a tooling test fails.

13. The `site-audit` job. Three arms in `ci.yml`; each is a required check:
    - `site-audit (pages)`: browserless HTTP checks (every address in the sitemap, robots, the root redirect); browser checks (width sweep, device set, axe, console, image size, modal open on load); form submission without JavaScript; screenshots.
    - `site-audit (mobile)`: Lighthouse mobile, three runs per template; the LCP element is text.
    - `site-audit (desktop)`: Lighthouse desktop, three runs per template.

    The scripts are in `tooling/site-audit/`, in TypeScript; the median and threshold logic is tested with `node --test`. The dependencies are in `devDependencies` with exact versions: `lighthouse` 13.6.0, `puppeteer-core` 25.16.0, `axe-core` 4.14.0, `schema-dts` 2.1.0. Artifacts use `actions/upload-artifact`, pinned by SHA.

14. Phases.
    - Phase 3: `site-audit` is set up with a skeleton page and becomes a required check; threshold file and `policy` check; two Semgrep rules (`<script>` element, `100vh`); Neon and Vercel in the same region.
    - Phase 4: the CSP PR writes `style-src` as in rule 10; the console check tests the CSP in a real browser.
    - Phase 5: touch target and viewport height tokens; mobile first-screen typography; an axe helper in component tests.
    - Phase 6: each page PR adds its template to the audit list; the home page and other templates open with text on mobile; SEO, JSON-LD, robots and sitemap; contact form without JavaScript.
    - Phase 7: admin pages join the audit.
    - Phase 8: manual WCAG 2.2 AA review; budgets get smaller.
    - Phase 9: production gets indexed, production measurement, structured data validation.

## Consequences

- Positive: the "full score" of each layer is a criterion, a tool and a check that turns red. The claim in the README is tied to the CI report.
- Positive: errors that a unit test cannot see, such as a CSP violation, a broken layout or overflow, are caught in a real browser. The `style-src` error in the measurement was not visible in any of the four Lighthouse scores.
- Positive: a first screen that opens with text on mobile meets both the performance gate and the first-screen fix from the design review.
- Positive: measurement is independent of Vercel; the same script also runs locally on Windows.
- Positive: the JSON-LD question is closed without exceptions; the `dangerouslySetInnerHTML` ban stays absolute.
- Negative: on mobile, an image cannot be the largest element of the first screen in any template. The home page banner and the images of product, project and reference pages sit below the text or smaller than it on mobile; this binds the design of phases 5 and 6.
- Negative: the strict gate of 100 leaves a narrow margin for run-to-run variation. With variation the threshold does not drop; the run count goes up or the page's budget gets smaller.
- Negative: CI runs three more jobs on every PR; the duration is measured in phase 3. With strict branch protection, PRs in the queue run them again.
- Negative: four new development dependencies. axe-core is MPL-2.0; it is used only in development and is not part of the production bundle, and the license policy looks at production dependencies. Lighthouse has an error-reporting sub-dependency; it is off by default in the CLI and is not used in the Node API.
- Negative: the version of Chrome on the runner is not fixed; it changes with the image, and the version is written in the report.
- Risk: because production is indexed, search and AI crawlers can call dynamic pages and use up the CPU and call quota of Hobby; on Hobby an overage means a 30-day wait. The AI Bots and Bot Protection rule sets of Vercel are also available on Hobby; in phase 9 they are first watched in "Log" mode.
- Risk: the fictional brand appears in search results. The demo banner and the content say that the brand is fictional; there is no postal address and no `LocalBusiness` in structured data.
- Risk: the agent category of Lighthouse is experimental. A Lighthouse update may bring a new audit and break the gate; this is treated as a wanted signal and handled in the Dependabot PR.
- Accepted gap: automated testing finds only part of the accessibility problems. The manual review in phase 8 covers the rest: keyboard, screen reader, focus visibility and focus not obscured (WCAG 2.4.11), dragging alternative (2.5.7, the before/after slider), accessible authentication (3.3.8).
- Accepted gap: production performance and INP field data are not a gate.
- The decision "no browser test tool" in [ADR 0007](0007-testing-strategy.md) is partly changed: there is still no functional test or end-to-end test framework; page audits run in a real Chrome with puppeteer-core, and there is a single functional scenario (contact form submission without JavaScript). The status line of ADR 0007 shows this.
- The statement "no Lighthouse gates" in the context of [ADR 0008](0008-ci-and-protection-layers.md) is replaced by this decision; three arms are added to the required checks. The status line of ADR 0008 shows this.
- Open items:
  - WebMCP: when the origin trial ends and it reaches stable Chrome, a declarative description is added to the contact form (phase 9 or later).
  - If the Chrome on the runner causes variation, the project moves to a fixed version of Chrome for Testing.
  - If an arm takes more than ten minutes, the template list is split across arms.
  - A 308 redirect from the old address when the language-independent address key of a product changes: phase 4, content schema 2.
  - A check that the fixed header does not cover the focused element: phase 6, the site layout PR.
  - `Product` markup: depends on the outcome of the pricing decision for products.

## Sources

- https://github.com/GoogleChrome/lighthouse/releases
- https://github.com/GoogleChrome/lighthouse/blob/v13.6.0/core/config/default-config.js
- https://github.com/GoogleChrome/lighthouse/blob/v13.6.0/core/gather/gatherers/accessibility.js
- https://developer.chrome.com/docs/lighthouse/agentic-browsing/scoring
- https://developer.chrome.com/docs/ai/webmcp
- https://web.dev/articles/ai-agent-site-ux
- https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- https://developers.google.com/search/docs/appearance/ai-features
- https://developers.google.com/search/docs/specialty/international/localized-versions
- https://developers.google.com/search/docs/appearance/structured-data/product-snippet
- https://nextjs.org/docs/app/guides/json-ld
- https://html.spec.whatwg.org/multipage/scripting.html#prepare-the-script-element
- https://www.w3.org/TR/WCAG22/
- https://gs.statcounter.com/screen-resolution-stats/mobile/worldwide
- https://vercel.com/kb/guide/are-vercel-preview-deployment-indexed-by-search-engines
- https://vercel.com/docs/vercel-firewall/vercel-waf/managed-rulesets
- https://registry.npmjs.org/lighthouse/13.6.0
- https://registry.npmjs.org/@lhci/cli/0.15.1
