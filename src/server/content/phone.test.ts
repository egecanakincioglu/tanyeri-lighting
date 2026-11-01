// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isValidPhone, phoneToTel } from './phone.ts';

describe('isValidPhone', () => {
  it.each(['+90 212 000 00 00', '(0312) 123-45-67', '5550000', '1'.repeat(20), '+1-202-555-0143'])(
    'accepts %s',
    (phone) => {
      expect(isValidPhone(phone)).toBe(true);
    },
  );

  it.each(['', '123456', '1'.repeat(21), '555-abc-0000', '90+5550000000', '+', '()- ', '555.000.0000'])(
    'rejects %j',
    (phone) => {
      expect(isValidPhone(phone)).toBe(false);
    },
  );

  it('counts digits, not characters', () => {
    expect(isValidPhone('+(1) 2-3 4-5 6-7')).toBe(true);
    expect(isValidPhone('+(1) 2-3 4-5 6-')).toBe(false);
  });
});

describe('phoneToTel', () => {
  it('keeps the digits and the leading plus', () => {
    expect(phoneToTel('+90 (212) 000-00-00')).toBe('+902120000000');
  });

  it('gives digits only for a number without a plus', () => {
    expect(phoneToTel('0212 000 00 00')).toBe('02120000000');
  });

  it('ignores surrounding whitespace', () => {
    expect(phoneToTel('  +90 212 000 00 00 ')).toBe('+902120000000');
  });
});
