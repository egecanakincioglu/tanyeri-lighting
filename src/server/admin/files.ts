import { isDemoMode } from '../env.ts';
import { deleteFile, isStorageEnabled } from '../storage/index.ts';

// The host of the file store, as next.config.ts lists it for images.
const STORE_HOST = /\.public\.blob\.vercel-storage\.com$/;

function isStoredAddress(address: string): boolean {
  try {
    const url = new URL(address);
    return url.protocol === 'https:' && STORE_HOST.test(url.hostname);
  } catch {
    return false;
  }
}

// Call it after a save that replaced or removed a file, with the address the record held before. It only touches
// files of the file store: a demo picture (/demo/...) or any other address is left alone. A failure is logged and
// never fails the save, which has already happened; the file is then an orphan, not a broken page.
export async function discardReplacedFile(before: string | null | undefined, after?: string | null): Promise<void> {
  if (!before || before === after || isDemoMode() || !isStorageEnabled() || !isStoredAddress(before)) return;
  try {
    await deleteFile(before);
  } catch (error) {
    console.error('Could not delete a replaced file', error);
  }
}
