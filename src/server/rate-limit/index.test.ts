// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { checkRateLimit, tooManyRequests } from './index.ts';

describe('tooManyRequests', () => {
  it('answers 429 with Retry-After and a JSON body', async () => {
    const response = tooManyRequests(42);
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('42');
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ error: 'Too many requests' });
  });
});

describe('checkRateLimit input checks', () => {
  const headers = new Headers();

  it.each([0, -1, 1.5, Number.NaN])('rejects the limit %s', async (limit) => {
    await expect(checkRateLimit({ scope: 'contact', limit, windowSeconds: 60, headers })).rejects.toThrow(RangeError);
  });

  it.each([0, -5, 0.5, 86_401, Number.NaN])('rejects the window %s', async (windowSeconds) => {
    await expect(checkRateLimit({ scope: 'contact', limit: 3, windowSeconds, headers })).rejects.toThrow(RangeError);
  });
});
