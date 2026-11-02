// The public hostname of the Blob store a read-write token belongs to. The token is "vercel_blob_rw_<store id>_<secret>"
// and the store serves its files from "<store id>.public.blob.vercel-storage.com" (the format of the storage library).
// Anything else, or no token, gives nothing, so the image optimizer then accepts no remote picture at all.
export function blobHostname(token: string | undefined): string | undefined {
  const [vendor, product, access, storeId = ''] = (token ?? '').trim().split('_');
  if (vendor !== 'vercel' || product !== 'blob' || access !== 'rw' || !/^[A-Za-z0-9]+$/.test(storeId)) return undefined;
  return `${storeId.toLowerCase()}.public.blob.vercel-storage.com`;
}
