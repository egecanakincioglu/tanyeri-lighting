import { getTranslations } from 'next-intl/server';
import type { Category } from '../../../server/content/schemas.ts';
import { commonFormProps } from '../form-common.ts';

export async function areaFormProps(locale: 'tr' | 'en', categories: Category[]) {
  const [t, form, common] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminAreas' }),
    getTranslations({ locale, namespace: 'AdminForm' }),
    commonFormProps(locale),
  ]);
  return {
    ...common,
    categories: [
      { value: '', label: t('noCategory') },
      ...categories.map((category) => ({ value: category.id, label: category.name[locale] })),
    ],
    texts: {
      image: t('fieldImage'),
      title: t('fieldTitle'),
      description: t('fieldDescription'),
      category: t('fieldCategory'),
      categoryHint: t('categoryHint'),
      cancel: form('cancel'),
    },
  };
}
