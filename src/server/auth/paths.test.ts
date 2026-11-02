import { describe, expect, it } from 'vitest';
import { panelPath, safeLocale, signInPath } from './paths.ts';

describe('safeLocale', () => {
  it('keeps a known language and falls back to the default for anything else', () => {
    expect(safeLocale('en')).toBe('en');
    expect(safeLocale('tr')).toBe('tr');
    expect(safeLocale('//evil.example')).toBe('tr');
    expect(safeLocale(null)).toBe('tr');
  });
});

describe('the admin addresses', () => {
  it('are localized', () => {
    expect(signInPath('en')).toBe('/en/admin/sign-in');
    expect(signInPath('tr')).toBe('/tr/yonetim/giris');
    expect(panelPath('en')).toBe('/en/admin');
    expect(panelPath('tr')).toBe('/tr/yonetim');
  });

  it('never take a target from the input', () => {
    expect(signInPath('https://evil.example')).toBe('/tr/yonetim/giris');
    expect(panelPath('//evil.example')).toBe('/tr/yonetim');
  });
});
