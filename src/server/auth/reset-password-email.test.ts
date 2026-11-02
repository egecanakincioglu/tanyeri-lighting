// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resetPasswordEmail, resetPasswordLink } from './reset-password-email.ts';

describe('resetPasswordLink', () => {
  it('points to the reset page of the panel in the default locale', () => {
    expect(resetPasswordLink('https://tanyeri.example.com', 'tok123')).toBe(
      'https://tanyeri.example.com/tr/yonetim/parola-sifirla?token=tok123',
    );
  });

  it('encodes the token', () => {
    expect(resetPasswordLink('http://localhost:3000', 'a b&c=d')).toBe(
      'http://localhost:3000/tr/yonetim/parola-sifirla?token=a+b%26c%3Dd',
    );
  });
});

describe('resetPasswordEmail', () => {
  const link = 'https://tanyeri.example.com/tr/yonetim/parola-sifirla?token=tok123';
  const message = resetPasswordEmail('admin@example.com', link);

  it('is plain text addressed to the user, with a bilingual subject', () => {
    expect(message.to).toBe('admin@example.com');
    expect(message.subject).toBe('Parola sıfırlama / Password reset');
    expect(message).not.toHaveProperty('html');
  });

  it('carries the link in both languages, Turkish first', () => {
    const turkish = message.text.indexOf('parola sıfırlama isteği');
    const english = message.text.indexOf('request to reset the password');
    expect(turkish).toBeGreaterThanOrEqual(0);
    expect(english).toBeGreaterThan(turkish);
    expect(message.text.split(link)).toHaveLength(3);
  });
});
