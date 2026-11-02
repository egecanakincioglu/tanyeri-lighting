import { getTranslations } from 'next-intl/server';
import { uploadMediaAction } from '../../../server/admin/upload-actions.ts';
import { isDemoMode } from '../../../server/env.ts';
import { isStorageEnabled, MAX_UPLOAD_BYTES } from '../../../server/storage/index.ts';
import { buildFormTexts } from '../texts.ts';

/** What both project pages (create and edit) pass to the form besides the action and the stored values. */
export async function projectFormProps(locale: 'tr' | 'en') {
  const [t, form, media, markdown] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminProjects' }),
    getTranslations({ locale, namespace: 'AdminForm' }),
    getTranslations({ locale, namespace: 'AdminMedia' }),
    getTranslations({ locale, namespace: 'AdminMarkdown' }),
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
      title: t('fieldTitle'),
      description: t('fieldDescription'),
      before: t('fieldBefore'),
      after: t('fieldAfter'),
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
    markdownTexts: {
      hint: markdown('hint'),
      edit: markdown('edit'),
      preview: markdown('preview'),
      loading: markdown('loading'),
    },
  };
}
