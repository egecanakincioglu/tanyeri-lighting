import { isIPv4, isIPv6 } from 'node:net';
import { isVercel } from '../env.ts';

// Shared bucket for requests outside Vercel, without the header, or with a value that is not an address.
export const UNKNOWN_ADDRESS = 'unknown';

// The eight 16-bit groups of a valid IPv6 address; an embedded IPv4 tail becomes two groups.
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

// A /64 is one subscriber who can rotate through 2^64 addresses, so it shares one bucket.
// IPv4-mapped IPv6 counts as IPv4.
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

// Read only from a header the server writes itself. Vercel overwrites x-forwarded-for; elsewhere anyone can send it
// and get a fresh bucket per request, so those requests share one bucket.
export function getClientAddress(headers: Headers): string {
  if (!isVercel()) return UNKNOWN_ADDRESS;
  const first = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return first ? normalizeAddress(first) : UNKNOWN_ADDRESS;
}
