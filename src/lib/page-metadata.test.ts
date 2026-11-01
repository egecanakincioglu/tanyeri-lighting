import { describe, expect, it } from 'vitest';
import type { PageMetadata } from '../server/content/schemas.ts';
import { toMetadata } from './page-metadata.ts';

const saved: PageMetadata = {
  title: { tr: 'İletişim', en: 'Contact' },
  description: { tr: 'Bize yazın', en: 'Write to us' },
  updatedAt: new Date(0),
};

describe('toMetadata', () => {
  it('uses the saved title and description in the visitor language', () => {
    expect(toMetadata(saved, 'tr')).toEqual({ title: 'İletişim', description: 'Bize yazın' });
    expect(toMetadata(saved, 'en')).toEqual({ title: 'Contact', description: 'Write to us' });
  });

  it('returns nothing for a page without saved metadata', () => {
    expect(toMetadata(null, 'en')).toEqual({});
  });

  it('prefers the title given by the page content over the saved one', () => {
    expect(toMetadata(saved, 'en', 'Privacy Policy')).toEqual({ title: 'Privacy Policy', description: 'Write to us' });
  });

  it('skips empty texts', () => {
    const empty: PageMetadata = { ...saved, title: { tr: '', en: '' }, description: { tr: '', en: '' } };
    expect(toMetadata(empty, 'tr')).toEqual({});
  });
});
