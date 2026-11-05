'use server';

import { guardAction } from '../auth/guard.ts';
import { assertWritable } from '../demo/guard.ts';
import { finalizeUpload } from '../storage/index.ts';
import { failure, runAction, type FormState } from './form.ts';

// The one upload door: the browser already put the file in temporary storage;
// the storage module checks and re-encodes it.
export async function finalizeMediaAction(address: string, kind: string): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    assertWritable();
    if (typeof address !== 'string' || (kind !== 'image' && kind !== 'file')) return failure('invalid');
    const stored = await finalizeUpload(address, kind);
    return { status: 'success', url: stored.url };
  });
}
