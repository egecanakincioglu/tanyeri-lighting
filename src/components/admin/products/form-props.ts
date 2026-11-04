import { getTranslations } from 'next-intl/server';
import { finalizeMediaAction } from '../../../server/admin/upload-actions.ts';
import type { Category } from '../../../server/content/schemas.ts';
import { isDemoMode } from '../../../server/env.ts';
import { isStorageEnabled } from '../../../server/storage/index.ts';
import { buildFormTexts } from '../texts.ts';

/** What both product pages (create and edit) pass to the form besides the action and the stored values. */
export async function productFormProps(locale: 'tr' | 'en', categories: Category[]) {
  const [t, form, media] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminProducts' }),
    getTranslations({ locale, namespace: 'AdminForm' }),
    getTranslations({ locale, namespace: 'AdminMedia' }),
  ]);
  const formTexts = buildFormTexts(form);
  return {
    locale,
    upload: finalizeMediaAction,
    formTexts,
    categories: categories.map((category) => ({ value: category.id, label: category.name[locale] })),
    readOnlyReason: isDemoMode() ? formTexts.demoNote : undefined,
    uploadDisabledReason: isStorageEnabled() ? undefined : media('storageOff'),
    texts: {
      image: t('fieldImage'),
      category: t('fieldCategory'),
      slug: t('fieldSlug'),
      slugHint: t('slugHint'),
      slugRedirectHint: t('slugRedirectHint'),
      code: t('fieldCode'),
      name: t('fieldName'),
      color: t('fieldColor'),
      material: t('fieldMaterial'),
      power: t('fieldPower'),
      dimensions: t('fieldDimensions'),
      description: t('fieldDescription'),
      luminousFlux: t('fieldLuminousFlux'),
      colorTemperature: t('fieldColorTemperature'),
      cri: t('fieldCri'),
      ip: t('fieldIp'),
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
