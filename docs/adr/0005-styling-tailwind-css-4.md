# ADR 0005: Styling - Tailwind CSS 4, no SCSS

Status: Accepted
Date: 2026-10-28

## Context

In the old code, all styles were in 59 SCSS modules (9,167 lines). Tailwind 3 was installed and active: its base styles were loaded, and 9 components used Tailwind classes next to their SCSS modules; there were two separate PostCSS configurations. The application is rewritten from scratch in the new repository: a new brand and design system in phase 5, pages and the panel in phases 6-7. The project decision is: **Tailwind CSS 4; design tokens in one source inside `@theme`; no SCSS in the project.**

Facts checked before the decision:

- The latest Tailwind version is 4.3.3; there is a separate LTS line for 3.x (3.4.19).
- Next.js setup: the packages `tailwindcss`, `@tailwindcss/postcss` and `postcss`; one plugin in `postcss.config.mjs`; `@import "tailwindcss";` in the CSS. The new project template of Next.js 16 comes with Tailwind and with Turbopack as the default.
- `@theme` namespaces: `--color-*`, `--font-*`, `--spacing`, `--radius-*`, `--shadow-*`, `--breakpoint-*`. The default palette can be disabled with `--color-*: initial`. For tokens that refer to another variable (for example a `next/font` variable) there is `@theme inline`.
- Next.js 16 moved to the modern Sass API (`sass-loader` 16). SCSS modules keep working during the transition.

## Options

| Option | Pros | Cons |
|---|---|---|
| Tailwind CSS 4, tokens in `@theme` | Tokens in one source, also usable as CSS variables; dead styles do not pile up; the same setup as the Next.js 16 template | Rewrite of 9,167 lines of SCSS; long class names |
| Stay on SCSS modules | No change | Tokens are scattered; the new brand and alignment work still touches every module; the `sass` dependency stays |
| CSS Modules and plain CSS variables | No extra dependency | The scale and utility classes must be written by hand; out of scope |

## Decision

**Tailwind CSS 4; no SCSS.**

Rules:

1. Setup follows the official Next.js guide: `tailwindcss` and `@tailwindcss/postcss` on the same exact version. There is a single PostCSS configuration: `postcss.config.ts`. If the Next.js version in use does not read a TypeScript PostCSS configuration, `postcss.config.mjs` is used and the reason is recorded. There is no Tailwind 3 configuration.
2. **One token source:** the `@theme` block in `src/app/globals.css` (or in a single `theme.css` that it imports).
   - Color, typography, the spacing scale (`--spacing`), radius, shadow and breakpoints are defined here.
   - Breakpoints are named for the widths 390, 768, 1024 and 1440 (phase 5).
   - Fonts are loaded with `next/font` and linked with `@theme inline`.
3. Components are written with Tailwind from scratch; no SCSS file enters the project.
4. The `sass` dependency is not added.

## Consequences

- Positive: The new brand (phase 5) is applied by changing tokens in one file. Alignment and spacing consistency come from the scale.
- Positive: Unused styles are not generated.
- Negative: Style changes are verified not with unit tests but with a visual check at desktop (1440) and mobile (390) widths ([ADR 0007](0007-testing-strategy.md)).
- Follow-up: Tailwind 4.x patch releases arrive through Dependabot's grouped minor/patch PR.
- Open items (to be decided in phase 5 together with the brand tokens):
  - Disabling the default color namespace with `--color-*: initial` and defining only the brand colors.
  - Arbitrary values such as `[#123456]` and `[13px]` are allowed only with the reason written in a comment. A value that is needed repeatedly gets a token in `@theme`.

  Both are preliminary proposals.

## Sources

- https://github.com/tailwindlabs/tailwindcss/releases
- https://registry.npmjs.org/-/package/tailwindcss/dist-tags
- https://tailwindcss.com/docs/installation/framework-guides/nextjs
- https://tailwindcss.com/docs/theme
- https://nextjs.org/blog/next-16
- https://nextjs.org/docs/app/guides/upgrading/version-16
