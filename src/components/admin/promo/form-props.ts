import { getTranslations } from 'next-intl/server';
import { listCatalogs } from '../../../server/content/catalogs.ts';
import { commonFormProps } from '../form-common.ts';

/** What both promo board pages (create and edit) pass to the form besides the action and the stored values. */
export async function promoFormProps(locale: 'tr' | 'en') {
  const [t, form, common, catalogs] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminPromo' }),
    getTranslations({ locale, namespace: 'AdminForm' }),
    commonFormProps(locale),
    listCatalogs(),
  ]);
  return {
    ...common,
    catalogs: catalogs.map((catalog) => ({ value: catalog.id, label: catalog.name[locale] })),
    texts: {
      image: t('fieldImage'),
      title: t('fieldTitle'),
      subtitle: t('fieldSubtitle'),
      catalog: t('fieldCatalog'),
      noCatalogs: t('noCatalogs'),
      cancel: form('cancel'),
    },
  };
}
