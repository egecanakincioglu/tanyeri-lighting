import { isIPv4, isIPv6 } from 'node:net';
import { isVercel } from '../env.ts';
import { ipv6Groups } from '../rate-limit/client-address.ts';

// Stored when there is no usable address (outside Vercel, no header, or a value that is not an address).
export const UNKNOWN_VISITOR = 'unknown';

// The only form in which a visitor's address is ever stored: IPv4 loses its last byte, IPv6 keeps its first 48 bits.
// An IPv4-mapped IPv6 address is an IPv4 visitor behind a dual-stack socket and is cut as IPv4.
export function anonymizeAddress(value: string): string {
  const address = value.split('%')[0]?.trim() ?? '';
  if (isIPv4(address)) return `${address.split('.').slice(0, 3).join('.')}.0`;
  if (!isIPv6(address)) return UNKNOWN_VISITOR;
  const groups = ipv6Groups(address);
  const [g6 = 0, g7 = 0] = groups.slice(6);
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    return `${g6 >> 8}.${g6 & 255}.${g7 >> 8}.0`;
  }
  return `${groups
    .slice(0, 3)
    .map((group) => group.toString(16))
    .join(':')}::`;
}

// Same trust rule as the rate limiter: the forwarding header is only read where the host writes it itself.
export function anonymizedClientAddress(headers: Headers): string {
  if (!isVercel()) return UNKNOWN_VISITOR;
  const first = headers.get('x-forwarded-for')?.split(',')[0];
  return first ? anonymizeAddress(first) : UNKNOWN_VISITOR;
}
