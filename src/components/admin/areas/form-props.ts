import { getTranslations } from 'next-intl/server';
import { commonFormProps } from '../form-common.ts';

/** What both application area pages (create and edit) pass to the form besides the action and the stored values. */
export async function areaFormProps(locale: 'tr' | 'en') {
  const [t, form, common] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminAreas' }),
    getTranslations({ locale, namespace: 'AdminForm' }),
    commonFormProps(locale),
  ]);
  return {
    ...common,
    texts: {
      image: t('fieldImage'),
      title: t('fieldTitle'),
      description: t('fieldDescription'),
      cancel: form('cancel'),
    },
  };
}
