// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { HONEYPOT_FIELD, isHoneypotFilled, MAX_LENGTH, parseContactForm, submittedValues } from './form.ts';

const VALID = {
  name: 'Ayse Yilmaz',
  email: 'ayse@example.com',
  subject: 'Quote request',
  message: 'Hello, I would like a quote.',
  locale: 'tr',
};

function form(overrides: Record<string, string | Blob> = {}): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...VALID, ...overrides })) data.set(key, value);
  return data;
}

describe('parseContactForm', () => {
  it('accepts a valid form', () => {
    expect(parseContactForm(form())).toEqual({ success: true, data: VALID });
  });

  it('trims every field', () => {
    const result = parseContactForm(
      form({ name: '  Ayse  ', email: ' ayse@example.com ', subject: '\tHi\n', message: ' text ' }),
    );
    expect(result).toEqual({
      success: true,
      data: { ...VALID, name: 'Ayse', subject: 'Hi', message: 'text' },
    });
  });

  it('accepts both site locales', () => {
    expect(parseContactForm(form({ locale: 'en' }))).toMatchObject({ success: true, data: { locale: 'en' } });
  });

  it('accepts values exactly at the maximum length', () => {
    const result = parseContactForm(
      form({ name: 'n'.repeat(MAX_LENGTH.name), subject: 's'.repeat(MAX_LENGTH.subject), message: 'm'.repeat(5000) }),
    );
    expect(result.success).toBe(true);
  });

  it.each(['name', 'email', 'subject', 'message', 'locale'])('reports %s as required when it is missing', (field) => {
    const data = form();
    data.delete(field);
    expect(parseContactForm(data)).toEqual({ success: false, fieldErrors: { [field]: 'required' } });
  });

  it('reports a value of only whitespace as required', () => {
    expect(parseContactForm(form({ subject: '   \n ' }))).toEqual({
      success: false,
      fieldErrors: { subject: 'required' },
    });
  });

  it.each([
    ['name', MAX_LENGTH.name + 1],
    ['subject', MAX_LENGTH.subject + 1],
    ['message', MAX_LENGTH.message + 1],
  ])('reports %s over its maximum as too long', (field, length) => {
    expect(parseContactForm(form({ [field]: 'x'.repeat(length) }))).toEqual({
      success: false,
      fieldErrors: { [field]: 'too_long' },
    });
  });

  it('counts the length after trimming', () => {
    const padded = `  ${'n'.repeat(MAX_LENGTH.name)}  `;
    expect(parseContactForm(form({ name: padded })).success).toBe(true);
  });

  it.each(['not-an-address', 'a@b', 'two@@example.com', 'sp ace@example.com'])('rejects the email %s', (email) => {
    expect(parseContactForm(form({ email }))).toEqual({ success: false, fieldErrors: { email: 'invalid' } });
  });

  it('reports an email over the maximum as too long', () => {
    const email = `${'a'.repeat(250)}@example.com`;
    expect(parseContactForm(form({ email }))).toEqual({ success: false, fieldErrors: { email: 'too_long' } });
  });

  it('rejects a locale the site does not have', () => {
    expect(parseContactForm(form({ locale: 'de' }))).toEqual({ success: false, fieldErrors: { locale: 'invalid' } });
  });

  it('rejects the NUL character, which the database cannot store', () => {
    expect(parseContactForm(form({ message: 'before\0after' }))).toEqual({
      success: false,
      fieldErrors: { message: 'invalid' },
    });
  });

  it('treats an uploaded file in a text field as missing', () => {
    expect(parseContactForm(form({ name: new File(['x'], 'x.txt') }))).toEqual({
      success: false,
      fieldErrors: { name: 'required' },
    });
  });

  it('reports every failing field at once', () => {
    expect(parseContactForm(form({ name: '', email: 'nope', message: 'x'.repeat(6000) }))).toEqual({
      success: false,
      fieldErrors: { name: 'required', email: 'invalid', message: 'too_long' },
    });
  });

  it('ignores fields it does not know', () => {
    expect(parseContactForm(form({ role: 'admin' }))).toEqual({ success: true, data: VALID });
  });
});

describe('isHoneypotFilled', () => {
  it('is false when the field is absent or empty', () => {
    expect(isHoneypotFilled(form())).toBe(false);
    expect(isHoneypotFilled(form({ [HONEYPOT_FIELD]: '' }))).toBe(false);
    expect(isHoneypotFilled(form({ [HONEYPOT_FIELD]: '   ' }))).toBe(false);
  });

  it('is true when the field has any content', () => {
    expect(isHoneypotFilled(form({ [HONEYPOT_FIELD]: 'https://spam.example' }))).toBe(true);
    expect(isHoneypotFilled(form({ [HONEYPOT_FIELD]: new File(['x'], 'x.txt') }))).toBe(true);
  });
});

describe('submittedValues', () => {
  it('returns the four text fields untrimmed', () => {
    expect(submittedValues(form({ name: '  Ayse ', message: ' hi\n' }))).toEqual({
      name: '  Ayse ',
      email: VALID.email,
      subject: VALID.subject,
      message: ' hi\n',
    });
  });

  it('turns missing fields and uploaded files into empty text and leaves the honeypot out', () => {
    const data = form({ subject: new File(['x'], 'x.txt'), [HONEYPOT_FIELD]: 'spam' });
    data.delete('email');
    const values = submittedValues(data);
    expect(values).toEqual({ name: VALID.name, email: '', subject: '', message: VALID.message });
    expect(Object.keys(values)).not.toContain(HONEYPOT_FIELD);
  });
});
