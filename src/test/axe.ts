import axe from 'axe-core';

/** Runs axe with the WCAG 2.2 AA rule tags. Color contrast needs real layout, so jsdom skips it. */
export async function axeViolations(container: Element) {
  const { violations } = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    rules: { 'color-contrast': { enabled: false } },
  });
  return violations;
}
