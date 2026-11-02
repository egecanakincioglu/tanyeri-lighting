import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import robots from './robots.ts';

// connection() only works inside a request; opting into dynamic rendering is its whole effect.
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));

describe('robots', () => {
  beforeEach(() => {
    vi.stubEnv('SITE_URL', 'https://example.test');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('opens the public pages and closes the API and admin area when indexing is on', async () => {
    vi.stubEnv('SITE_INDEXING', 'on');
    expect(await robots()).toEqual({
      rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/tr/yonetim', '/en/admin'] },
      sitemap: 'https://example.test/sitemap.xml',
    });
  });

  it('closes everything while indexing is off, and still names the sitemap', async () => {
    vi.stubEnv('SITE_INDEXING', 'off');
    expect(await robots()).toEqual({
      rules: { userAgent: '*', disallow: '/' },
      sitemap: 'https://example.test/sitemap.xml',
    });
  });

  it('is off by default', async () => {
    vi.stubEnv('SITE_INDEXING', undefined);
    expect((await robots()).rules).toEqual({ userAgent: '*', disallow: '/' });
  });

  it.each(['on', 'off'])('gives one rule to all crawlers and names none when indexing is %s', async (value) => {
    vi.stubEnv('SITE_INDEXING', value);
    const { rules } = await robots();
    expect(Array.isArray(rules)).toBe(false);
    expect(rules).toMatchObject({ userAgent: '*' });
  });
});
