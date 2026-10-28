// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import proxy, { config } from './proxy.ts';

async function redirectLocation(path: string, acceptLanguage?: string) {
  const headers = acceptLanguage ? { 'accept-language': acceptLanguage } : undefined;
  const response = await proxy(new NextRequest(`http://localhost:3000${path}`, { headers }));
  return { status: response.status, location: response.headers.get('location') };
}

describe('proxy', () => {
  it('redirects the root to /en for an English Accept-Language', async () => {
    const result = await redirectLocation('/', 'en-US,en;q=0.9');
    expect(result.status).toBe(307);
    expect(result.location).toBe('http://localhost:3000/en');
  });

  it('redirects the root to /tr for a Turkish Accept-Language', async () => {
    const result = await redirectLocation('/', 'tr-TR,tr;q=0.9');
    expect(result.location).toBe('http://localhost:3000/tr');
  });

  it('redirects the root to /tr when no language matches', async () => {
    const result = await redirectLocation('/', 'de-DE,de;q=0.9');
    expect(result.location).toBe('http://localhost:3000/tr');
  });

  it('redirects the root to /tr without an Accept-Language header', async () => {
    const result = await redirectLocation('/');
    expect(result.location).toBe('http://localhost:3000/tr');
  });

  it('does not redirect a prefixed path', async () => {
    const result = await redirectLocation('/en', 'tr');
    expect(result.location).toBeNull();
  });

  it('excludes api and static files from the matcher', () => {
    const pattern = new RegExp(`^${config.matcher[0]}$`);
    expect(pattern.test('/tr')).toBe(true);
    expect(pattern.test('/api/health')).toBe(false);
    expect(pattern.test('/favicon.ico')).toBe(false);
    expect(pattern.test('/_next/static/app.js')).toBe(false);
  });

  describe('content security policy', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    const get = (path: string) => proxy(new NextRequest(`http://localhost:3000${path}`));
    const scriptSrc = (csp: string) => csp.split('; ').find((d) => d.startsWith('script-src ')) ?? '';

    it('sets the policy on a page response', async () => {
      const csp = (await get('/tr')).headers.get('content-security-policy') ?? '';
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("default-src 'self'");
      expect(csp).not.toContain('upgrade-insecure-requests');
    });

    it('uses a fresh nonce for every request', async () => {
      const first = (await get('/tr')).headers.get('content-security-policy');
      const second = (await get('/tr')).headers.get('content-security-policy');
      expect(first).not.toBe(second);
    });

    it('puts the same nonce in the policy and in the forwarded request headers', async () => {
      const response = await get('/tr');
      const csp = response.headers.get('content-security-policy') ?? '';
      const nonce = /'nonce-([^']+)'/.exec(scriptSrc(csp))?.[1];
      expect(nonce).toBeTruthy();
      expect(response.headers.get('x-middleware-override-headers')).toContain('content-security-policy');
      expect(response.headers.get('x-middleware-request-content-security-policy')).toBe(csp);
    });

    it('never allows inline or eval scripts in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const script = scriptSrc((await get('/tr')).headers.get('content-security-policy') ?? '');
      expect(script).toContain("'strict-dynamic'");
      expect(script).not.toContain('unsafe-inline');
      expect(script).not.toContain('unsafe-eval');
    });

    it('allows eval only in development', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      const script = scriptSrc((await get('/tr')).headers.get('content-security-policy') ?? '');
      expect(script).toContain("'unsafe-eval'");
      expect(script).not.toContain('unsafe-inline');
    });

    it('sends the policy together with the root redirect', async () => {
      const response = await get('/');
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost:3000/tr');
      expect(response.headers.get('content-security-policy')).toContain("script-src 'self' 'nonce-");
    });

    it('sends no Link header', async () => {
      expect((await get('/tr')).headers.get('link')).toBeNull();
      expect((await get('/')).headers.get('link')).toBeNull();
    });
  });
});
