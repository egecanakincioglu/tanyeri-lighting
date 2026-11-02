'use server';

import { guardAction } from '../auth/guard.ts';
import { assertWritable } from '../demo/guard.ts';
import { uploadFile } from '../storage/index.ts';
import { failure, runAction, type FormState } from './form.ts';

// The one upload door of the panel: every image and file field posts here. The storage module checks the size and the
// real type and re-encodes images; the address it returns goes into the field's hidden input.
export async function uploadMediaAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    assertWritable();
    const file = formData.get('file');
    if (!(file instanceof Blob) || file.size === 0) return failure('invalid');
    const stored = await uploadFile(file);
    return { status: 'success', url: stored.url };
  });
}
