import { describe, expect, it } from 'vitest';
import { blobHostname } from './blob-hostname.ts';

describe('blobHostname', () => {
  it('derives the public host of the store from the token', () => {
    expect(blobHostname('vercel_blob_rw_AbC123xyz_secretvalue')).toBe('abc123xyz.public.blob.vercel-storage.com');
    expect(blobHostname('  vercel_blob_rw_store1_s_e  ')).toBe('store1.public.blob.vercel-storage.com');
  });

  it('gives nothing without a token or for a value that is not a read-write token', () => {
    expect(blobHostname(undefined)).toBeUndefined();
    expect(blobHostname('')).toBeUndefined();
    expect(blobHostname('vercel_blob_rw__secret')).toBeUndefined();
    expect(blobHostname('vercel_blob_rw_a.b_secret')).toBeUndefined();
    expect(blobHostname('vercel_blob_client_store1_secret')).toBeUndefined();
    expect(blobHostname('something-else')).toBeUndefined();
  });
});
