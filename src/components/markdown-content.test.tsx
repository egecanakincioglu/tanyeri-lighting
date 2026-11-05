import { cleanup, render } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';
import { MarkdownContent } from './markdown-content.tsx';

function renderMarkdown(source: string) {
  return render(
    <main>
      <h1>Page title</h1>
      <MarkdownContent>{source}</MarkdownContent>
    </main>,
  ).container;
}

describe('MarkdownContent', () => {
  afterEach(cleanup);

  it('renders paragraphs, emphasis and line breaks', () => {
    const root = renderMarkdown('First **bold** and *italic* text.\n\nSecond line one  \nline two');
    expect(root.querySelectorAll('p')).toHaveLength(2);
    expect(root.querySelector('strong')?.textContent).toBe('bold');
    expect(root.querySelector('em')?.textContent).toBe('italic');
    expect(root.querySelectorAll('br')).toHaveLength(1);
  });

  it('renders bullet and numbered lists', () => {
    const root = renderMarkdown('- one\n- two\n\n1. first\n2. second');
    expect(root.querySelectorAll('ul > li')).toHaveLength(2);
    expect(root.querySelectorAll('ol > li')).toHaveLength(2);
  });

  it('keeps the page to one h1 by moving headings down', () => {
    const root = renderMarkdown('# One\n\n## Two\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six');
    expect(root.querySelectorAll('h1')).toHaveLength(1);
    expect(root.querySelector('h1')?.textContent).toBe('Page title');
    expect([...root.querySelectorAll('h2, h3')].map((node) => `${node.tagName}:${node.textContent}`)).toEqual([
      'H2:One',
      'H2:Two',
      'H3:Three',
      'H3:Four',
      'H3:Five',
      'H3:Six',
    ]);
    expect(root.querySelectorAll('h4, h5, h6')).toHaveLength(0);
  });

  it('gives a link to another site rel="noopener noreferrer"', () => {
    const root = renderMarkdown('[a](https://example.com/x) [b](http://example.com) [c](//example.com/y)');
    const links = [...root.querySelectorAll('a')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://example.com/x',
      'http://example.com',
      '//example.com/y',
    ]);
    for (const link of links) expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('leaves links on the site and mail links without rel', () => {
    const root = renderMarkdown('[a](/tr/iletisim) [b](#top) [c](mailto:info@example.com)');
    const links = [...root.querySelectorAll('a')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/tr/iletisim', '#top', 'mailto:info@example.com']);
    for (const link of links) expect(link.hasAttribute('rel')).toBe(false);
  });

  it.each(['javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,<b>x</b>', 'vbscript:msgbox(1)'])(
    'removes the dangerous link target %s',
    (target) => {
      const root = renderMarkdown(`[click me](${target})`);
      const link = root.querySelector('a');
      expect(link?.hasAttribute('href')).toBe(false);
      expect(link?.textContent).toBe('click me');
    },
  );

  it('does not render a raw script element', () => {
    const root = renderMarkdown('Before\n\n<script>window.hacked = true</script>\n\nAfter');
    expect(root.querySelector('script')).toBeNull();
    expect(root.innerHTML).not.toContain('<script');
  });

  it('does not render raw html with an event handler', () => {
    const root = renderMarkdown('<img src="x" onerror="window.hacked = true">\n\nText <b onclick="alert(1)">bold</b>');
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('b')).toBeNull();
    expect(root.innerHTML).not.toMatch(/onerror|onclick/i);
  });

  it('does not render html blocks such as iframes and styles', () => {
    const root = renderMarkdown('<iframe src="https://example.com"></iframe>\n\n<style>body{display:none}</style>');
    expect(root.querySelector('iframe')).toBeNull();
    expect(root.querySelector('style')).toBeNull();
  });

  it('drops images and reduces code and quotes to their text', () => {
    const root = renderMarkdown('![alt text](https://example.com/a.png)\n\n`code` and\n\n> quote\n\n```\nblock\n```');
    for (const tag of ['img', 'code', 'pre', 'blockquote']) expect(root.querySelector(tag)).toBeNull();
    expect(root.textContent).toContain('quote');
    expect(root.textContent).toContain('block');
  });

  it('has no accessibility violations', async () => {
    const root = renderMarkdown(
      [
        '## Section',
        'A paragraph with [a link](https://example.com), **bold** and *italic*.',
        '### Part',
        '- one',
        '- two',
        '1. first',
        '2. second',
      ].join('\n\n'),
    );
    // jsdom does not compute colors, so the contrast rule cannot run here.
    const results = await axe.run(root, {
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
