// Public hostname of the store a read-write token belongs to: "<store id>.public.blob.vercel-storage.com".
// Anything else gives nothing, so the image optimizer accepts no remote picture.
export function blobHostname(token: string | undefined): string | undefined {
  const [vendor, product, access, storeId = ''] = (token ?? '').trim().split('_');
  if (vendor !== 'vercel' || product !== 'blob' || access !== 'rw' || !/^[A-Za-z0-9]+$/.test(storeId)) return undefined;
  return `${storeId.toLowerCase()}.public.blob.vercel-storage.com`;
}
