import { getTranslations } from 'next-intl/server';
import { uploadMediaAction } from '../../../server/admin/upload-actions.ts';
import { isDemoMode } from '../../../server/env.ts';
import { isStorageEnabled, MAX_UPLOAD_BYTES } from '../../../server/storage/index.ts';
import { buildFormTexts } from '../texts.ts';

/** What both catalog pages (create and edit) pass to the form besides the action and the stored values. */
export async function catalogFormProps(locale: 'tr' | 'en') {
  const [t, form, media] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminCatalogs' }),
    getTranslations({ locale, namespace: 'AdminForm' }),
    getTranslations({ locale, namespace: 'AdminMedia' }),
  ]);
  const formTexts = buildFormTexts(form);
  const common = {
    choose: media('choose'),
    replace: media('replace'),
    clear: media('clear'),
    uploading: media('uploading'),
    none: media('none'),
    open: media('open'),
  };
  return {
    locale,
    upload: uploadMediaAction,
    maxBytes: MAX_UPLOAD_BYTES,
    formTexts,
    readOnlyReason: isDemoMode() ? formTexts.demoNote : undefined,
    uploadDisabledReason: isStorageEnabled() ? undefined : media('storageOff'),
    texts: { name: t('fieldName'), pdf: t('fieldPdf'), cover: t('fieldCover'), cancel: form('cancel') },
    fileTexts: { ...common, hint: media('fileHint') },
    imageTexts: { ...common, hint: t('coverHint') },
  };
}
