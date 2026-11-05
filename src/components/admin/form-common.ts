import { getTranslations } from 'next-intl/server';
import { finalizeMediaAction } from '../../server/admin/upload-actions.ts';
import { isDemoMode } from '../../server/env.ts';
import { isStorageEnabled } from '../../server/storage/index.ts';
import { buildFormTexts } from './texts.ts';

export async function commonFormProps(locale: 'tr' | 'en') {
  const [form, media] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminForm' }),
    getTranslations({ locale, namespace: 'AdminMedia' }),
  ]);
  const formTexts = buildFormTexts(form);
  return {
    locale,
    upload: finalizeMediaAction,
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
