import { isIPv4, isIPv6 } from 'node:net';
import { isVercel } from '../env.ts';

// Every request outside Vercel, without the header or with a value that is not an address falls into this one bucket.
export const UNKNOWN_ADDRESS = 'unknown';

// The eight 16-bit groups of a valid IPv6 address. An embedded IPv4 tail ("::ffff:1.2.3.4") becomes two groups.
export function ipv6Groups(address: string): number[] {
  let text = address;
  const lastColon = text.lastIndexOf(':');
  const tail = text.slice(lastColon + 1);
  if (tail.includes('.')) {
    const [a = 0, b = 0, c = 0, d = 0] = tail.split('.').map(Number);
    text = `${text.slice(0, lastColon + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head = '', rest] = text.split('::');
  const before = head ? head.split(':') : [];
  const after = rest ? rest.split(':') : [];
  const zeros = Array<string>(8 - before.length - after.length).fill('0');
  return [...before, ...zeros, ...after].map((group) => parseInt(group, 16));
}

// A whole /64 is one subscriber, so one client can rotate through 2^64 addresses; they must share a bucket.
// IPv4-mapped IPv6 addresses are IPv4 clients behind a dual-stack socket and are counted as IPv4.
function normalizeAddress(value: string): string {
  const address = value.split('%')[0] ?? '';
  if (isIPv4(address)) return address;
  if (!isIPv6(address)) return UNKNOWN_ADDRESS;
  const groups = ipv6Groups(address);
  const [g6 = 0, g7 = 0] = groups.slice(6);
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    return `${g6 >> 8}.${g6 & 255}.${g7 >> 8}.${g7 & 255}`;
  }
  return `${groups
    .slice(0, 4)
    .map((group) => group.toString(16))
    .join(':')}::/64`;
}

// ADR 0004 rule 4: the address is read only from a header the server itself writes. Vercel overwrites
// x-forwarded-for and does not pass a client-sent value through. Anywhere else anyone can send the header, so
// trusting it would let a caller pick a fresh bucket per request; those requests share one bucket instead.
export function getClientAddress(headers: Headers): string {
  if (!isVercel()) return UNKNOWN_ADDRESS;
  const first = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return first ? normalizeAddress(first) : UNKNOWN_ADDRESS;
}
