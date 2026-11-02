import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JsonLd } from './json-ld.tsx';

describe('JsonLd', () => {
  it('writes the data as one ld+json script', () => {
    const html = renderToString(<JsonLd data={{ '@type': 'Thing', name: 'Lamp' }} />);
    expect(html).toMatch(/^<script type="application\/ld\+json">/);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    const text = html.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
    expect(JSON.parse(text)).toEqual({ '@type': 'Thing', name: 'Lamp' });
  });

  it('keeps text that tries to close the script as plain data', () => {
    const name = '</script><script>alert(1)</script>';
    const html = renderToString(<JsonLd data={{ name }} />);
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    const text = html.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
    expect(JSON.parse(text)).toEqual({ name });
  });
});
