import axe from 'axe-core';

/** WCAG 2.2 AA rules; color contrast is skipped because jsdom has no layout. */
export async function axeViolations(container: Element) {
  const { violations } = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    rules: { 'color-contrast': { enabled: false } },
  });
  return violations;
}
