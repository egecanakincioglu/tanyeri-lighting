// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseResetInput } from './admin.ts';

describe('parseResetInput', () => {
  it('returns the lower-cased email and the password', () => {
    expect(parseResetInput('Admin@Example.com', 'a password of enough length')).toEqual({
      email: 'admin@example.com',
      password: 'a password of enough length',
    });
  });

  it('names the email option when it is missing or malformed', () => {
    expect(() => parseResetInput(undefined, 'a password of enough length')).toThrow(/--email/);
    expect(() => parseResetInput('nonsense', 'a password of enough length')).toThrow(/--email/);
  });

  it('rejects a password shorter than 12 characters without echoing it', () => {
    expect(() => parseResetInput('admin@example.com', 'short-11-ch')).toThrow(/at least 12/);
    expect(() => parseResetInput('admin@example.com', 'short-11-ch')).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('short-11-ch') }),
    );
    expect(parseResetInput('admin@example.com', 'exactly-12-ch').password).toBe('exactly-12-ch');
  });

  it('reports both problems together', () => {
    expect(() => parseResetInput(undefined, '')).toThrow(/--email[\s\S]*password/);
  });
});
