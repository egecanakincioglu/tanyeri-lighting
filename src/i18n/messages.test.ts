import { describe, expect, it } from 'vitest';
import en from '../../messages/en.json' with { type: 'json' };
import tr from '../../messages/tr.json' with { type: 'json' };

function keyPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) {
    return [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) => keyPaths(child, prefix ? `${prefix}.${key}` : key));
}

describe('messages', () => {
  it('has the same key set in both languages', () => {
    expect(keyPaths(tr).sort()).toEqual(keyPaths(en).sort());
  });

  it('has no empty strings', () => {
    for (const messages of [tr, en]) {
      const values = JSON.stringify(messages).match(/""/g);
      expect(values).toBeNull();
    }
  });
});
