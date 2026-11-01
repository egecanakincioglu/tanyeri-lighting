// Lenient on purpose: people write numbers in many layouts. Only digits, spaces, ( ) and - are allowed, and a plus
// sign only at the start; 7 to 20 digits in total (the E.164 limit is 15, extensions and prefixes need a little more).
const PHONE_PATTERN = /^\+?[\d\s()-]+$/;
const MIN_DIGITS = 7;
const MAX_DIGITS = 20;

// The digits of a number, with the leading plus kept: "+90 (212) 000-00-00" becomes "+902120000000". This is the
// part after `tel:` in a link.
export function phoneToTel(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return phone.trimStart().startsWith('+') ? `+${digits}` : digits;
}

export function isValidPhone(phone: string): boolean {
  if (!PHONE_PATTERN.test(phone)) return false;
  const digits = phone.replace(/\D/g, '').length;
  return digits >= MIN_DIGITS && digits <= MAX_DIGITS;
}
