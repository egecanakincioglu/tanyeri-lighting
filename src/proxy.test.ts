// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
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
});
