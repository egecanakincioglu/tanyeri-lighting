import { describe, expect, it } from 'vitest';
import CatchAllPage from './page.tsx';

describe('CatchAllPage', () => {
  it('responds with 404', () => {
    expect(() => CatchAllPage()).toThrow(expect.objectContaining({ digest: expect.stringContaining('404') }));
  });
});
