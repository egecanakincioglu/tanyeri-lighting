import { afterEach, describe, expect, it, vi } from 'vitest';
import { UNKNOWN_VISITOR, anonymizeAddress, anonymizedClientAddress } from './anonymize.ts';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('anonymizeAddress', () => {
  it('cuts IPv4 to its /24', () => {
    expect(anonymizeAddress('203.0.113.77')).toBe('203.0.113.0');
    expect(anonymizeAddress(' 10.1.2.255 ')).toBe('10.1.2.0');
  });

  it('cuts IPv6 to its /48, whatever the written form', () => {
    expect(anonymizeAddress('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toBe('2001:db8:1::');
    expect(anonymizeAddress('2001:0DB8:0001:ffff:0:0:0:1')).toBe('2001:db8:1::');
    expect(anonymizeAddress('2001:db8::1')).toBe('2001:db8:0::');
    expect(anonymizeAddress('::1')).toBe('0:0:0::');
    expect(anonymizeAddress('fe80::1%eth0')).toBe('fe80:0:0::');
  });

  it('treats an IPv4-mapped IPv6 address as IPv4', () => {
    expect(anonymizeAddress('::ffff:203.0.113.7')).toBe('203.0.113.0');
    expect(anonymizeAddress('::ffff:cb00:7107')).toBe('203.0.113.0');
  });

  it('never returns the last byte of an IPv4 address or the host part of an IPv6 address', () => {
    expect(anonymizeAddress('198.51.100.123')).not.toContain('123');
    expect(anonymizeAddress('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).not.toMatch(/aaaa|bbbb|cccc|dddd/);
  });

  it.each(['', ' ', 'not-an-address', '999.1.1.1', '1.2.3', '2001:db8::g', '<script>', '1.2.3.4.5'])(
    'answers unknown for malformed input %j',
    (value) => {
      expect(anonymizeAddress(value)).toBe(UNKNOWN_VISITOR);
    },
  );
});

describe('anonymizedClientAddress', () => {
  it('reads the first value of x-forwarded-for on Vercel and anonymizes it', () => {
    vi.stubEnv('VERCEL', '1');
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.77, 10.0.0.1' });
    expect(anonymizedClientAddress(headers)).toBe('203.0.113.0');
  });

  it('is unknown without the header on Vercel', () => {
    vi.stubEnv('VERCEL', '1');
    expect(anonymizedClientAddress(new Headers())).toBe(UNKNOWN_VISITOR);
  });

  it('ignores a spoofed x-forwarded-for outside Vercel', () => {
    vi.stubEnv('VERCEL', '');
    expect(anonymizedClientAddress(new Headers({ 'x-forwarded-for': '198.51.100.99' }))).toBe(UNKNOWN_VISITOR);
  });
});
