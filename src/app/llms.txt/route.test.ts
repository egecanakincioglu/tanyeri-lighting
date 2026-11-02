import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route.ts';

describe('llms.txt', () => {
  beforeEach(() => {
    vi.stubEnv('SITE_URL', 'https://example.test');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('answers with plain text', () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
  });

  it('has a heading, says the brand is a fictional demo, and is long enough for the audit', async () => {
    const text = await GET().text();
    expect(text).toMatch(/^# Tanyeri Lighting$/m);
    expect(text).toContain('fictional demo brand');
    expect(text.length).toBeGreaterThan(50);
  });

  it('links the main pages in both languages on the configured host', async () => {
    const text = await GET().text();
    expect(text).toContain('- [Products](https://example.test/en/products)');
    expect(text).toContain('- [Ürünler](https://example.test/tr/urunler)');
    expect(text).toContain('- [Contact](https://example.test/en/contact)');
    const links = [...text.matchAll(/\]\((.+?)\)/g)].map((match) => match[1]!);
    expect(links).toHaveLength(16);
    expect(links.every((url) => url.startsWith('https://example.test/'))).toBe(true);
  });

  it('follows a different site address', async () => {
    vi.stubEnv('SITE_URL', 'https://other.test');
    expect(await GET().text()).toContain('https://other.test/en/products');
  });
});
