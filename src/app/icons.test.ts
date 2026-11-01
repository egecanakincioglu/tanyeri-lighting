import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const appDir = import.meta.dirname;
const publicDir = join(appDir, '..', '..', 'public');

async function size(path: string) {
  const { width, height, format } = await sharp(path).metadata();
  return { width, height, format };
}

describe('site images', () => {
  it('ship an apple touch icon of 180 x 180', async () => {
    expect(await size(join(appDir, 'apple-icon.png'))).toEqual({ width: 180, height: 180, format: 'png' });
  });

  it('ship manifest icons of 192 and 512 pixels', async () => {
    expect(await size(join(publicDir, 'icons', 'icon-192.png'))).toEqual({ width: 192, height: 192, format: 'png' });
    expect(await size(join(publicDir, 'icons', 'icon-512.png'))).toEqual({ width: 512, height: 512, format: 'png' });
  });

  it('ship a square vector icon', () => {
    const svg = readFileSync(join(appDir, 'icon.svg'), 'utf8');
    expect(svg).toContain('viewBox="0 0 512 512"');
  });

  it('ship an Open Graph image of 1200 x 630 under 100 KB', async () => {
    const path = join(appDir, 'opengraph-image.png');
    expect(await size(path)).toEqual({ width: 1200, height: 630, format: 'png' });
    expect(statSync(path).size).toBeLessThan(100 * 1024);
  });
});
