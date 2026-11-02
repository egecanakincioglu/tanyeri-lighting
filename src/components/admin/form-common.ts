import { getTranslations } from 'next-intl/server';
import { uploadMediaAction } from '../../server/admin/upload-actions.ts';
import { isDemoMode } from '../../server/env.ts';
import { isStorageEnabled, MAX_UPLOAD_BYTES } from '../../server/storage/index.ts';
import { buildFormTexts } from './texts.ts';

/** What every panel form with an image gets besides its own texts: the upload door, the limits and the shared texts. */
export async function commonFormProps(locale: 'tr' | 'en') {
  const [form, media] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminForm' }),
    getTranslations({ locale, namespace: 'AdminMedia' }),
  ]);
  const formTexts = buildFormTexts(form);
  return {
    locale,
    upload: uploadMediaAction,
    maxBytes: MAX_UPLOAD_BYTES,
    formTexts,
    readOnlyReason: isDemoMode() ? formTexts.demoNote : undefined,
    uploadDisabledReason: isStorageEnabled() ? undefined : media('storageOff'),
    mediaTexts: {
      choose: media('choose'),
      replace: media('replace'),
      clear: media('clear'),
      uploading: media('uploading'),
      none: media('none'),
      hint: media('imageHint'),
      open: media('open'),
    },
  };
}
