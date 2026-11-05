import { isDemoMode } from '../env.ts';
import { deleteFile, isStorageEnabled } from '../storage/index.ts';

const STORE_HOST = /\.public\.blob\.vercel-storage\.com$/;

function isStoredAddress(address: string): boolean {
  try {
    const url = new URL(address);
    return url.protocol === 'https:' && STORE_HOST.test(url.hostname);
  } catch {
    return false;
  }
}

// Only files of the file store are touched. A failure is logged and never fails the save; the file becomes an orphan.
export async function discardReplacedFile(before: string | null | undefined, after?: string | null): Promise<void> {
  if (!before || before === after || isDemoMode() || !isStorageEnabled() || !isStoredAddress(before)) return;
  try {
    await deleteFile(before);
  } catch (error) {
    console.error('Could not delete a replaced file', error);
  }
}

// Same for a whole record; forms upload a new file per record, so no address is shared.
export async function discardChangedFiles<T extends object>(
  before: T | null | undefined,
  after: T | null | undefined,
  fields: readonly (keyof T)[],
): Promise<void> {
  for (const field of fields) {
    const previous = before?.[field];
    const current = after?.[field];
    await discardReplacedFile(
      typeof previous === 'string' ? previous : null,
      typeof current === 'string' ? current : null,
    );
  }
}
