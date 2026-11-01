# ADR 0010: Quality thresholds — Lighthouse gate at 90, expected 95+

Status: Accepted
Date: 2026-10-28

## Context

[ADR 0009](0009-quality-targets.md) set a strict gate of 100 for the four Lighthouse categories (performance, accessibility, best practices, SEO), on mobile and on desktop. The costs of that gate:

- There is no margin for run-to-run variation. A one-point drop turns the PR red.
- To keep 100 on mobile, the LCP element had to be text on every template (ADR 0009, rule 4). A page with an image as the LCP element scored 98–99 on mobile in the project's measurement (see the measurements in ADR 0009). The rule restricted the design of all templates only for performance.
- The TBT budgets (90 ms on mobile, 60 ms on desktop) and the CLS budget (0.02) existed only to keep the score at 100.

100 is too strict. The goal should be realistic.

## Options

| Option | Pros | Cons | Result |
|---|---|---|---|
| Strict 100 (ADR 0009) | A full score is proven in every PR | No margin for variation; an image in the first screen is forbidden on mobile; budgets are tight because of the score | Rejected |
| Gate 90, expected 95+ | Margin for variation; design is freer; a drop is still visible | 100 is not proven | Chosen |
| Warning only, no gate | Most flexible | A regression can merge; goes back to having no Lighthouse gates | Rejected |

## Decision

**The Lighthouse gate is lowered to 90; the expectation is 95 and above.** The rules of ADR 0009 that are not mentioned here stay in force.

Rules:

1. Lighthouse thresholds. Four categories, mobile and desktop, median of three runs per template (ADR 0009, rule 3):
   - Below 90: `site-audit (mobile)` or `site-audit (desktop)` is red.
   - 90–94: the job stays green; the page and category are written as a GitHub warning annotation and listed in the job summary.
   - 95 and above: the expected level.
   - The thresholds are in `tooling/site-audit/thresholds.json`; they only go up and never below 90. `policy` rejects loosening; tightening is a separate commit.
2. The pass/fail audits do not change. They give no score, so the 90/95 split does not apply to them: axe violations 0; all applicable audits of "Agentic Browsing" pass; horizontal overflow 0; `target-size` violations 0; console errors and CSP violations 0; SEO and GEO HTTP checks; the contact form works without JavaScript (ADR 0009, rules 1 and 5).
3. The text-LCP requirement on mobile is removed. Rule 4 of ADR 0009 and the "LCP element is text" check in `site-audit (mobile)` no longer apply. An image can be the LCP element. The image in the first screen is loaded as in ADR 0009, rule 6: with `preload`, `fetchPriority="high"` and the correct `sizes`.
4. The first-screen design rule stays. The first screen of the home page has a single `h1` with a value proposition and action buttons. This is now a design requirement, not a performance one. (The design review found that the old site's biggest gap was the lack of text and actions in the first screen; the fix is an `h1` with a value proposition and two actions in the banner.)
5. Budgets. This replaces the table in ADR 0009, rule 6:

   | Metric | Mobile | Desktop |
   |---|---|---|
   | Lighthouse performance (median) | at least 90, expected 95+ | same |
   | JavaScript transfer | at most 180 KB | same |
   | CSS transfer | at most 30 KB | same |
   | Fonts | at most 2 files, 100 KB | same |
   | Total transfer | at most 500 KB | same |

   The TBT, CLS and LCP element rows are removed: they existed to keep the score at 100, and the performance gate already covers them. The transfer budgets are measured on the runner in phase 3 and then fixed; after that they only get smaller. The design rules in rule 6 stay in force.

## Consequences

- Positive: run-to-run variation does not turn the PR red; on mobile, the first screen can open with an image; the measurement tools and jobs do not change.
- Negative: 100 is no longer proven. A drop between 90 and 94 shows only as a warning, so someone has to notice and fix it.
- Changed places: the status line of ADR 0009, the ADR index, the roadmap (the `site-audit` row, the phase 4 content schema and phase 6 home page items).

## Sources

- [ADR 0009: Quality targets](0009-quality-targets.md), including the measurement of the page with an image LCP (98–99 on mobile) and the calculation of the TBT limits.
