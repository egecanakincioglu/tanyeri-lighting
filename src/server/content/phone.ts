// Lenient: digits, spaces, ( ) and -, a plus only at the start, 7 to 20 digits (E.164 allows 15; extensions need more).
const PHONE_PATTERN = /^\+?[\d\s()-]+$/;
const MIN_DIGITS = 7;
const MAX_DIGITS = 20;

// Keeps digits and a leading plus, for `tel:` links.
export function phoneToTel(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return phone.trimStart().startsWith('+') ? `+${digits}` : digits;
}

export function isValidPhone(phone: string): boolean {
  if (!PHONE_PATTERN.test(phone)) return false;
  const digits = phone.replace(/\D/g, '').length;
  return digits >= MIN_DIGITS && digits <= MAX_DIGITS;
}
