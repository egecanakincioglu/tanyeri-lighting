import { getTranslations } from 'next-intl/server';
import { uploadMediaAction } from '../../../server/admin/upload-actions.ts';
import { isDemoMode } from '../../../server/env.ts';
import { isStorageEnabled, MAX_UPLOAD_BYTES } from '../../../server/storage/index.ts';
import { buildFormTexts } from '../texts.ts';

/** What both reference pages (create and edit) pass to the form besides the action and the stored values. */
export async function referenceFormProps(locale: 'tr' | 'en') {
  const [t, form, media] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminReferences' }),
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
    texts: {
      image: t('fieldImage'),
      name: t('fieldName'),
      title: t('fieldTitle'),
      description: t('fieldDescription'),
      cancel: form('cancel'),
    },
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
