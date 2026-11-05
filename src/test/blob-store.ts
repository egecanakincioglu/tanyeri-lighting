import { randomUUID } from 'node:crypto';
import { put } from '@vercel/blob';
import { getBlobToken } from '../server/env.ts';

export async function storeFile(bytes: Uint8Array, extension = 'pdf'): Promise<string> {
  const result = await put(`${randomUUID()}.${extension}`, Buffer.from(bytes), {
    access: 'public',
    token: getBlobToken(),
  });
  return result.url;
}
