'use server';

import { guardAction } from '../auth/guard.ts';
import { assertWritable } from '../demo/guard.ts';
import { finalizeUpload } from '../storage/index.ts';
import { failure, runAction, type FormState } from './form.ts';

// The one upload door of the panel: the browser has already put the file into the store's temporary folder
// (src/app/api/admin/upload/route.ts); every image and file field then calls this. The storage module checks the
// address, the size and the real type and re-encodes images; the address it returns goes into the field's hidden input.
export async function finalizeMediaAction(address: string, kind: string): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    assertWritable();
    if (typeof address !== 'string' || (kind !== 'image' && kind !== 'file')) return failure('invalid');
    const stored = await finalizeUpload(address, kind);
    return { status: 'success', url: stored.url };
  });
}
