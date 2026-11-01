// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getClientAddress, UNKNOWN_ADDRESS } from './client-address.ts';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getClientAddress on Vercel', () => {
  it('uses the first value of x-forwarded-for', () => {
    vi.stubEnv('VERCEL', '1');
    const headers = new Headers({ 'x-forwarded-for': ' 203.0.113.7 , 10.0.0.1' });
    expect(getClientAddress(headers)).toBe('203.0.113.7');
  });

  it('falls back to the shared bucket when the header is missing or empty', () => {
    vi.stubEnv('VERCEL', '1');
    expect(getClientAddress(new Headers())).toBe(UNKNOWN_ADDRESS);
    expect(getClientAddress(new Headers({ 'x-forwarded-for': ' ' }))).toBe(UNKNOWN_ADDRESS);
  });
});

describe('getClientAddress address forms on Vercel', () => {
  function address(value: string): string {
    return getClientAddress(new Headers({ 'x-forwarded-for': value }));
  }

  it('keeps IPv4 as it is', () => {
    vi.stubEnv('VERCEL', '1');
    expect(address('203.0.113.7')).toBe('203.0.113.7');
  });

  it('puts every address of one /64 in the same bucket', () => {
    vi.stubEnv('VERCEL', '1');
    const first = address('2001:db8:1:2:aaaa:bbbb:cccc:dddd');
    expect(address('2001:db8:1:2::1')).toBe(first);
    expect(address('2001:0DB8:0001:0002:0:0:0:ffff')).toBe(first);
    expect(address('2001:db8:1:2:ffff:ffff:ffff:ffff%eth0')).toBe(first);
  });

  it('keeps different /64 prefixes apart', () => {
    vi.stubEnv('VERCEL', '1');
    expect(address('2001:db8:1:2::1')).not.toBe(address('2001:db8:1:3::1'));
    expect(address('2001:db8:1:2::1')).not.toBe(address('2001:db8:2:2::1'));
  });

  it('expands compressed forms before cutting the prefix', () => {
    vi.stubEnv('VERCEL', '1');
    expect(address('2001:db8::1')).toBe(address('2001:db8:0:0:5::9'));
    expect(address('::1')).toBe(address('0:0:0:0:1:2:3:4'));
    expect(address('::')).toBe(address('0:0:0:0::'));
  });

  it('treats IPv4-mapped IPv6 as IPv4, in dotted and hex form', () => {
    vi.stubEnv('VERCEL', '1');
    expect(address('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(address('::ffff:cb00:7107')).toBe('203.0.113.7');
    expect(address('0:0:0:0:0:ffff:1.2.3.4')).toBe('1.2.3.4');
  });

  it('does not treat other IPv4-embedding forms as mapped', () => {
    vi.stubEnv('VERCEL', '1');
    expect(address('64:ff9b::1.2.3.4')).toBe(address('64:ff9b::9.9.9.9'));
  });

  it('falls back to the shared bucket for a value that is not an address', () => {
    vi.stubEnv('VERCEL', '1');
    expect(address('not-an-address')).toBe(UNKNOWN_ADDRESS);
    expect(address('999.1.1.1')).toBe(UNKNOWN_ADDRESS);
    expect(address('2001:db8::g')).toBe(UNKNOWN_ADDRESS);
  });
});

describe('getClientAddress outside Vercel', () => {
  it('ignores a spoofed x-forwarded-for', () => {
    vi.stubEnv('VERCEL', '');
    const headers = new Headers({ 'x-forwarded-for': '198.51.100.99' });
    expect(getClientAddress(headers)).toBe(UNKNOWN_ADDRESS);
  });
});
